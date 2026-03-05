/**
 * GATEWAY CONFIG
 * ==============
 * Centralized OpenClaw gateway URL and auth token wiring for the UI.
 */

const GATEWAY_UI_CONFIG_KEY = "shellcorp.gateway-config.v1";
const DEFAULT_GATEWAY_BASE = import.meta.env.VITE_GATEWAY_URL || "http://127.0.0.1:18789";
const DEFAULT_GATEWAY_TOKEN = import.meta.env.VITE_GATEWAY_TOKEN || "";
const DEFAULT_STATE_BASE =
  import.meta.env.VITE_STATE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173");
const DEFAULT_LANGUAGE = "English";
const DEFAULT_SESSION_KEY = "";

export type GatewayUiConfig = {
  gatewayBase: string;
  gatewayToken: string;
  stateBase: string;
  defaultSessionKey: string;
  language: string;
};

function readStoredGatewayUiConfig(): Partial<GatewayUiConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GATEWAY_UI_CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      gatewayBase: typeof parsed.gatewayBase === "string" ? parsed.gatewayBase : undefined,
      gatewayToken: typeof parsed.gatewayToken === "string" ? parsed.gatewayToken : undefined,
      stateBase: typeof parsed.stateBase === "string" ? parsed.stateBase : undefined,
      defaultSessionKey: typeof parsed.defaultSessionKey === "string" ? parsed.defaultSessionKey : undefined,
      language: typeof parsed.language === "string" ? parsed.language : undefined,
    };
  } catch {
    return {};
  }
}

function resolveGatewayUiConfig(): GatewayUiConfig {
  const stored = readStoredGatewayUiConfig();
  return {
    gatewayBase: stored.gatewayBase?.trim() || DEFAULT_GATEWAY_BASE,
    gatewayToken: stored.gatewayToken?.trim() || DEFAULT_GATEWAY_TOKEN,
    stateBase: stored.stateBase?.trim() || DEFAULT_STATE_BASE,
    defaultSessionKey: stored.defaultSessionKey?.trim() || DEFAULT_SESSION_KEY,
    language: stored.language?.trim() || DEFAULT_LANGUAGE,
  };
}

export function getGatewayUiConfig(): GatewayUiConfig {
  return resolveGatewayUiConfig();
}

export function saveGatewayUiConfig(next: Partial<GatewayUiConfig>): GatewayUiConfig {
  const current = resolveGatewayUiConfig();
  const merged: GatewayUiConfig = {
    gatewayBase: next.gatewayBase?.trim() ?? current.gatewayBase,
    gatewayToken: next.gatewayToken?.trim() ?? current.gatewayToken,
    stateBase: next.stateBase?.trim() ?? current.stateBase,
    defaultSessionKey: next.defaultSessionKey?.trim() ?? current.defaultSessionKey,
    language: next.language?.trim() ?? current.language,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GATEWAY_UI_CONFIG_KEY, JSON.stringify(merged));
  }
  return merged;
}

export const gatewayBase = resolveGatewayUiConfig().gatewayBase;
export const gatewayToken = resolveGatewayUiConfig().gatewayToken;
export const stateBase = resolveGatewayUiConfig().stateBase;

export type GatewayConnectionState = "ok" | "unauthorized" | "unreachable" | "error";

export function buildGatewayHeaders(init: HeadersInit = {}): HeadersInit {
  const headers = new Headers(init);
  if (gatewayToken.trim()) {
    const bearer = `Bearer ${gatewayToken.trim()}`;
    headers.set("authorization", bearer);
    // Compatibility header for gateways that expose token header-based auth.
    headers.set("x-openclaw-token", gatewayToken.trim());
  }
  return headers;
}

export function hasGatewayToken(): boolean {
  return gatewayToken.trim().length > 0;
}
