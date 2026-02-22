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
        { key: "channels.whatsapp.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "channels.whatsapp.authDir", label: "Auth directory", required: false, example: "~/.fahrenheit/credentials/whatsapp" },
        { key: "channels.whatsapp.printQr", label: "Print QR in terminal", required: false, example: "true" },
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
    });
    this.socket = socket;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && this.printQr) {
        qrcode.generate(qr, { small: true });
      }
      if (connection === "open") {
        this.connected = true;
        this.lastError = undefined;
      }
      if (connection === "close") {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
          ?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          this.lastError = "whatsapp_logged_out_repair_required";
          return;
        }
        if (this.shouldRun) {
          this.lastError = "whatsapp_disconnected_reconnecting";
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
}
