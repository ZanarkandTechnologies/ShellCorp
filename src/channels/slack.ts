/**
 * Slack channel adapter (Socket Mode).
 *
 * Responsibility:
 * - Listen to Slack message events and normalize into gateway envelopes.
 * - Send outbound gateway responses via Slack Web API.
 */
import { App } from "@slack/bolt";
import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import type { ProviderSetupSpec, ProviderStatus } from "./base.js";
import { formatLogLine, sanitizeInline } from "../logging/pretty.js";

interface SlackInboundEvent {
  type: string;
  subtype?: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
}

interface SlackHistoryMessage {
  text?: string;
  user?: string;
  ts?: string;
}

export class SlackChannel implements BaseChannel {
  readonly id = "slack";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;
  private readonly app: App;
  private connected = false;
  private lastError: string | undefined;

  constructor(
    private readonly botToken: string,
    private readonly appToken: string,
  ) {
    this.app = new App({
      token: botToken,
      appToken,
      socketMode: true,
    });
  }

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    try {
      const forwardEvent = async (msg: SlackInboundEvent, forceThreadRoot = false): Promise<void> => {
        if (!this.inboundHandler) return;
        if (!msg.user || !msg.channel || !msg.text?.trim()) return;
        const isGroup = !msg.channel.startsWith("D");
        const threadId = msg.thread_ts ?? (forceThreadRoot ? msg.ts : undefined);
        const history = await this.fetchHistory(msg.channel, msg.ts, threadId);
        console.info(
          formatLogLine("slack", "inbound", {
            sourceId: msg.channel,
            senderId: msg.user,
            isGroup,
            threadId,
            eventType: msg.type,
            content: sanitizeInline(msg.text),
          }),
        );

        await this.inboundHandler({
          channelId: "slack",
          sourceId: msg.channel,
          senderId: msg.user,
          senderName: msg.user,
          content: msg.text,
          timestamp: msg.ts ? Math.floor(Number(msg.ts) * 1000) : Date.now(),
          isGroup,
          threadId,
          raw: {
            ts: msg.ts,
            threadTs: msg.thread_ts,
            type: msg.type,
            history,
          },
        });
      };

      this.app.event("message", async ({ event }) => {
        const msg = event as SlackInboundEvent;
        if (msg.subtype) return;
        await forwardEvent(msg);
      });

      this.app.event("app_mention", async ({ event }) => {
        const mention = event as SlackInboundEvent;
        await forwardEvent(mention, true);
      });

      await this.app.start();
      this.connected = true;
      this.lastError = undefined;
    } catch (error) {
      this.connected = false;
      this.lastError = error instanceof Error ? error.message : "slack_start_failed";
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.app.stop();
    this.connected = false;
  }

  async send(envelope: OutboundEnvelope): Promise<void> {
    await this.app.client.chat.postMessage({
      channel: envelope.sourceId,
      text: envelope.content,
      thread_ts: envelope.threadId,
    });
  }

  private async fetchHistory(channelId: string, ts: string | undefined, threadId: string | undefined): Promise<string[]> {
    try {
      const client = this.app.client as unknown as {
        conversations: {
          replies: (args: {
            channel: string;
            ts: string;
            limit: number;
            inclusive: boolean;
          }) => Promise<{ messages?: SlackHistoryMessage[] }>;
          history: (args: {
            channel: string;
            latest?: string;
            limit: number;
            inclusive: boolean;
          }) => Promise<{ messages?: SlackHistoryMessage[] }>;
        };
      };
      const response = threadId
        ? await client.conversations.replies({
            channel: channelId,
            ts: threadId,
            limit: 10,
            inclusive: true,
          })
        : await client.conversations.history({
            channel: channelId,
            latest: ts,
            limit: 10,
            inclusive: true,
          });
      const rows = Array.isArray(response.messages) ? response.messages : [];
      return rows
        .sort((a, b) => Number(a.ts ?? 0) - Number(b.ts ?? 0))
        .map((entry) => `${entry.user ?? "unknown"}: ${entry.text ?? ""}`.trim())
        .filter((line) => line.length > 0);
    } catch {
      // History enrichment is best-effort and should not block inbound handling.
      return [];
    }
  }

  getSetupSpec(): ProviderSetupSpec {
    return {
      providerId: this.id,
      title: "Slack App (Socket Mode)",
      summary: "Connect Slack Bot + App token for Socket Mode events and responses.",
      fields: [
        { key: "gateway.channels.slack.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.channels.slack.botToken", label: "Bot token (xoxb-...)", required: true, secret: true },
        { key: "gateway.channels.slack.appToken", label: "App token (xapp-...)", required: true, secret: true },
      ],
      docsUrl: "https://api.slack.com/apps",
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
}
