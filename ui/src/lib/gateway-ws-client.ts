/**
 * GATEWAY WS CLIENT
 * =================
 * WebSocket JSON-RPC client for OpenClaw gateway with device identity auth.
 *
 * Ported from the official OpenClaw Control UI (ui/src/ui/gateway.ts) with
 * the full connect.challenge -> Ed25519 signed device auth handshake.
 */

import { loadOrCreateDeviceIdentity, signDevicePayload, type DeviceIdentity } from "./device-identity";
import { clearDeviceAuthToken, loadDeviceAuthToken, storeDeviceAuthToken } from "./device-auth";

// --- Frame types ---

type GatewayRequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
};

type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code?: string; message?: string; details?: unknown };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

// --- Device auth payload (v2 format, matches src/gateway/device-auth.ts) ---

type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce: string;
};

function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
  ].join("|");
}

// --- Client constants (matches src/gateway/protocol/client-info.ts) ---

const CLIENT_ID = "openclaw-control-ui";
const CLIENT_MODE = "webchat";
const ROLE = "operator";
const SCOPES = ["operator.admin", "operator.approvals", "operator.pairing"];
const CLIENT_CAPS = ["tool-events"];
const CONNECT_FAILED_CLOSE_CODE = 4008;

// --- Helpers ---

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseGatewayError(value: unknown): string {
  if (!value || typeof value !== "object") return "gateway_request_failed";
  const row = value as { message?: unknown; code?: unknown };
  if (typeof row.message === "string" && row.message.trim()) return row.message;
  if (typeof row.code === "string" && row.code.trim()) return row.code;
  return "gateway_request_failed";
}

// --- Hello response shape ---

type GatewayHelloOk = {
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
  };
  [key: string]: unknown;
};

// --- Client options ---

export type GatewayWsClientOptions = {
  url: string;
  token?: string;
  onConnectionStateChange?: (connected: boolean) => void;
};

// --- Client ---

export class GatewayWsClient {
  private ws: WebSocket | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Set<(event: GatewayEventFrame) => void>();
  private closed = false;
  private connectSent = false;
  private connectNonce: string | null = null;
  private connectTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectBackoffMs = 800;
  private isReady = false;

  constructor(private readonly opts: GatewayWsClientOptions) {}

  get connected(): boolean {
    return this.isReady && this.ws?.readyState === WebSocket.OPEN;
  }

  start(): void {
    this.closed = false;
    this.openSocket();
  }

  stop(): void {
    this.closed = true;
    this.isReady = false;
    this.opts.onConnectionStateChange?.(false);
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
  }

  subscribe(listener: (event: GatewayEventFrame) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    if (method !== "connect" && !this.isReady) {
      return Promise.reject(new Error("gateway handshake pending"));
    }
    const id = createRequestId();
    const frame: GatewayRequestFrame = { type: "req", id, method, params };
    const responsePromise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return responsePromise;
  }

  // --- Socket lifecycle ---

  private openSocket(): void {
    if (this.closed) return;
    const ws = new WebSocket(this.opts.url);
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.queueConnectHandshake();
    });
    ws.addEventListener("message", (event) => {
      this.handleMessage(String(event.data ?? ""));
    });
    ws.addEventListener("close", (event) => {
      const reason = String(event.reason ?? "");
      this.ws = null;
      this.isReady = false;
      this.opts.onConnectionStateChange?.(false);
      this.flushPending(new Error(`gateway closed (${event.code}): ${reason}`));
      this.scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      // Close handler manages reconnect and pending failures.
    });
  }

  /**
   * Wait 750ms before sending connect so the server has time to send
   * connect.challenge first. If the challenge arrives sooner, sendConnect
   * is triggered immediately from handleMessage.
   */
  private queueConnectHandshake(): void {
    this.connectSent = false;
    this.connectNonce = null;
    this.isReady = false;
    this.opts.onConnectionStateChange?.(false);
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
    }
    this.connectTimer = window.setTimeout(() => {
      this.connectTimer = null;
      void this.sendConnect();
    }, 750);
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const isSecureContext = typeof crypto !== "undefined" && !!crypto.subtle;
    let deviceIdentity: DeviceIdentity | null = null;
    let canFallbackToShared = false;
    let authToken = this.opts.token;

    if (isSecureContext) {
      deviceIdentity = await loadOrCreateDeviceIdentity();
      const storedToken = loadDeviceAuthToken({
        deviceId: deviceIdentity.deviceId,
        role: ROLE,
      })?.token;
      authToken = storedToken ?? this.opts.token;
      canFallbackToShared = Boolean(storedToken && this.opts.token);
    }

    const auth =
      authToken?.trim()
        ? { token: authToken.trim() }
        : undefined;

    let device:
      | { id: string; publicKey: string; signature: string; signedAt: number; nonce: string }
      | undefined;

    if (isSecureContext && deviceIdentity) {
      const signedAtMs = Date.now();
      const nonce = this.connectNonce ?? "";
      const payload = buildDeviceAuthPayload({
        deviceId: deviceIdentity.deviceId,
        clientId: CLIENT_ID,
        clientMode: CLIENT_MODE,
        role: ROLE,
        scopes: SCOPES,
        signedAtMs,
        token: authToken ?? null,
        nonce,
      });
      const signature = await signDevicePayload(deviceIdentity.privateKey, payload);
      device = {
        id: deviceIdentity.deviceId,
        publicKey: deviceIdentity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: CLIENT_ID,
        version: "dev",
        platform: typeof navigator !== "undefined" ? navigator.platform : "web",
        mode: CLIENT_MODE,
      },
      role: ROLE,
      scopes: SCOPES,
      device,
      caps: CLIENT_CAPS,
      auth,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      locale: typeof navigator !== "undefined" ? navigator.language : "en-US",
    };

    try {
      const hello = await this.request<GatewayHelloOk>("connect", params);
      if (hello?.auth?.deviceToken && deviceIdentity) {
        storeDeviceAuthToken({
          deviceId: deviceIdentity.deviceId,
          role: hello.auth.role ?? ROLE,
          token: hello.auth.deviceToken,
          scopes: hello.auth.scopes ?? [],
        });
      }
      this.isReady = true;
      this.reconnectBackoffMs = 800;
      this.opts.onConnectionStateChange?.(true);
    } catch {
      if (canFallbackToShared && deviceIdentity) {
        clearDeviceAuthToken({ deviceId: deviceIdentity.deviceId, role: ROLE });
      }
      this.isReady = false;
      this.opts.onConnectionStateChange?.(false);
      this.ws?.close(CONNECT_FAILED_CLOSE_CODE, "connect failed");
    }
  }

  // --- Message dispatch ---

  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const frame = parsed as { type?: unknown };

    if (frame.type === "event") {
      const event = parsed as GatewayEventFrame;

      if (event.event === "connect.challenge") {
        const payload = event.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }

      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch {
          // Listener failures should not break socket processing.
        }
      }
      return;
    }

    if (frame.type === "res") {
      const response = parsed as GatewayResponseFrame;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve(response.payload);
      } else {
        pending.reject(new Error(parseGatewayError(response.error)));
      }
    }
  }

  // --- Helpers ---

  private flushPending(error: Error): void {
    for (const [, pending] of this.pending) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    if (this.reconnectTimer !== null) return;
    const delay = this.reconnectBackoffMs;
    this.reconnectBackoffMs = Math.min(Math.floor(this.reconnectBackoffMs * 1.7), 15_000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }
}
