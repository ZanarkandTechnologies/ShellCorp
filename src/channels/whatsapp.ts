/**
 * WhatsApp channel adapter (Baileys).
 *
 * Responsibility:
 * - Connect to WhatsApp Web via QR pairing.
 * - Persist auth/session credentials in multi-file state.
 * - Normalize inbound messages to gateway envelopes.
 * - Send outbound replies to WhatsApp chats.
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type WAMessage,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import type { ProviderSetupSpec, ProviderStatus } from "./base.js";
import { formatLogLine, sanitizeInline } from "../logging/pretty.js";

type BaileysLogger = {
  level: string;
  child: () => BaileysLogger;
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
};

function getMessageText(message: WAMessage): string {
  const payload = message.message;
  if (!payload) return "";
  if (payload.conversation) return payload.conversation;
  if (payload.extendedTextMessage?.text) return payload.extendedTextMessage.text;
  if (payload.imageMessage?.caption) return payload.imageMessage.caption;
  if (payload.videoMessage?.caption) return payload.videoMessage.caption;
  return "";
}

export class WhatsAppChannel implements BaseChannel {
  readonly id = "whatsapp";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private connected = false;
  private lastError: string | undefined;
  private shouldRun = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private qrAscii: string | undefined;

  constructor(
    private readonly authDir = path.join(process.cwd(), ".fahrenheit", "credentials", "whatsapp"),
    private readonly printQr = true,
  ) {}

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    this.shouldRun = true;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connected = false;
    if (this.socket?.ws) {
      this.socket.ws.close();
    }
    this.socket = null;
  }

  async send(envelope: OutboundEnvelope): Promise<void> {
    if (!this.socket) {
      throw new Error("whatsapp_not_connected");
    }
    await this.socket.sendMessage(envelope.sourceId, { text: envelope.content });
  }

  getSetupSpec(): ProviderSetupSpec {
    return {
      providerId: this.id,
      title: "WhatsApp (Baileys QR pairing)",
      summary: "Pair with WhatsApp by scanning a terminal QR code; credentials persist on disk.",
      fields: [
        { key: "gateway.channels.whatsapp.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.channels.whatsapp.authDir", label: "Auth directory", required: false, example: "~/.fahrenheit/credentials/whatsapp" },
        { key: "gateway.channels.whatsapp.printQr", label: "Print QR in terminal", required: false, example: "true" },
      ],
      docsUrl: "https://deepwiki.com/openclaw/openclaw",
    };
  }

  getStatus(): ProviderStatus {
    return {
      providerId: this.id,
      enabled: true,
      connected: this.connected,
      mode: "native",
      lastError: this.lastError,
      qrAscii: this.qrAscii,
    };
  }

  private async connect(): Promise<void> {
    await mkdir(this.authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      syncFullHistory: false,
      logger: this.createBaileysLogger() as any,
    });
    this.socket = socket;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && this.printQr) {
        qrcode.generate(qr, { small: true }, (ascii) => {
          this.qrAscii = ascii;
          this.lastError = "whatsapp_qr_scan_required";
          console.info(formatLogLine("whatsapp", "qr_required", { reason: this.lastError }));
          console.log(ascii);
        });
      }
      if (connection === "open") {
        this.connected = true;
        this.lastError = undefined;
        this.qrAscii = undefined;
        console.info(formatLogLine("whatsapp", "connection_open", {}));
      }
      if (connection === "close") {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
          ?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          this.lastError = "whatsapp_logged_out_repair_required";
          console.info(formatLogLine("whatsapp", "connection_closed", { reason: this.lastError, statusCode }));
          return;
        }
        if (this.shouldRun) {
          this.lastError = "whatsapp_disconnected_reconnecting";
          console.info(formatLogLine("whatsapp", "connection_closed", { reason: this.lastError, statusCode }));
          this.reconnectTimer = setTimeout(() => {
            void this.connect();
          }, 2000);
        }
      }
    });

    socket.ev.on("messages.upsert", async ({ messages }: any) => {
      if (!this.inboundHandler) return;
      for (const message of messages) {
        if (message.key.fromMe) continue;
        const content = getMessageText(message);
        if (!content.trim()) continue;
        const sourceId = message.key.remoteJid ?? "unknown";
        const senderId = message.key.participant ?? sourceId;
        console.info(
          formatLogLine("whatsapp", "inbound", {
            sourceId,
            senderId,
            isGroup: sourceId.endsWith("@g.us"),
            content: sanitizeInline(content),
          }),
        );
        await this.inboundHandler({
          channelId: "whatsapp",
          sourceId,
          senderId,
          senderName: message.pushName ?? senderId,
          content,
          timestamp:
            typeof message.messageTimestamp === "number"
              ? message.messageTimestamp * 1000
              : Number(message.messageTimestamp?.toString() ?? Date.now()),
          isGroup: sourceId.endsWith("@g.us"),
          raw: {
            remoteJid: sourceId,
            messageId: message.key.id,
          },
        });
      }
    });
  }

  private createBaileysLogger(): BaileysLogger {
    const writer = (level: "trace" | "debug" | "info" | "warn" | "error" | "fatal") =>
      (...args: unknown[]): void => {
        const entry = args.find((value) => typeof value === "string") ?? args[0];
        const line = formatLogLine("whatsapp", `baileys_${level}`, {
          details: sanitizeInline(entry),
        });
        if (level === "warn") {
          console.warn(line);
          return;
        }
        if (level === "error" || level === "fatal") {
          console.error(line);
          return;
        }
        console.info(line);
      };

    const logger: BaileysLogger = {
      level: "info",
      child: () => logger,
      trace: writer("trace"),
      debug: writer("debug"),
      info: writer("info"),
      warn: writer("warn"),
      error: writer("error"),
      fatal: writer("fatal"),
    };
    return logger;
  }
}
