/**
 * Discord channel adapter.
 *
 * Responsibility:
 * - Receive Discord messages and normalize them into gateway envelopes.
 * - Send outbound gateway replies back into the same Discord channel.
 */
import {
  ChannelType,
  Client,
  DiscordAPIError,
  GatewayIntentBits,
  Partials,
  RESTJSONErrorCodes,
  type Message,
} from "discord.js";
import type { BaseChannel } from "./base.js";
import type { InboundEnvelope, OutboundEnvelope } from "../types.js";
import type { ProviderSetupSpec, ProviderStatus } from "./base.js";
import { formatLogLine, sanitizeInline } from "../logging/pretty.js";

const discordThreadErrorCodes = {
  alreadyExists: 160004,
  locked: 160005,
  maxActive: 160006,
  maxActiveAnnouncement: 160007,
  archivedInvalidAction: 50083,
  missingPermissions: RESTJSONErrorCodes.MissingPermissions,
} as const;

export function describeDiscordThreadError(
  prefix: string,
  channelId: string,
  messageId: string,
  code: number | undefined,
  message: string,
): string {
  if (code === discordThreadErrorCodes.missingPermissions) {
    return `${prefix}:code=${code}:missing_permissions channel=${channelId} message=${messageId}`;
  }
  if (code === discordThreadErrorCodes.locked) {
    return `${prefix}:code=${code}:thread_locked channel=${channelId} message=${messageId}`;
  }
  if (code === discordThreadErrorCodes.maxActive || code === discordThreadErrorCodes.maxActiveAnnouncement) {
    return `${prefix}:code=${code}:thread_limit_reached channel=${channelId} message=${messageId}`;
  }
  if (code === discordThreadErrorCodes.archivedInvalidAction) {
    return `${prefix}:code=${code}:archived_thread_action channel=${channelId} message=${messageId}`;
  }
  return `${prefix}:code=${code ?? "na"}:${message} channel=${channelId} message=${messageId}`;
}

export function getDiscordThreadDecisionReason(
  hasThreadId: boolean,
  mentionedBot: boolean,
  hasReplyToMessageId: boolean,
): "thread_present" | "not_mentioned" | "missing_reply_context" | "create_thread" {
  if (hasThreadId) return "thread_present";
  if (!mentionedBot) return "not_mentioned";
  if (!hasReplyToMessageId) return "missing_reply_context";
  return "create_thread";
}

export class DiscordChannel implements BaseChannel {
  readonly id = "discord";
  private inboundHandler: ((envelope: InboundEnvelope) => Promise<void>) | null = null;
  private client: Client;
  private connected = false;
  private lastError: string | undefined;
  private degradedDmOnly = false;

  constructor(private readonly token: string) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });
  }

  setInboundHandler(handler: (envelope: InboundEnvelope) => Promise<void>): void {
    this.inboundHandler = handler;
  }

  async start(): Promise<void> {
    try {
      this.client.on("messageCreate", async (message: Message) => {
        if (!this.inboundHandler) return;
        if (message.author?.bot) return;
        if (this.degradedDmOnly && message.guildId) return;
        if (!message.content?.trim()) return;

        const isThreadChannel = "isThread" in message.channel && typeof message.channel.isThread === "function" && message.channel.isThread();
        const sourceId = isThreadChannel
          ? ("parentId" in message.channel && typeof message.channel.parentId === "string" ? message.channel.parentId : message.channel.id)
          : message.channel.id;
        const threadId =
          message.channel.type === ChannelType.PublicThread ||
          message.channel.type === ChannelType.PrivateThread ||
          message.channel.type === ChannelType.AnnouncementThread
            ? message.channel.id
            : undefined;
        const isGroup = message.channel.type !== ChannelType.DM && message.channel.type !== ChannelType.GroupDM;
        const botId = this.client.user?.id;
        const mentionByEntity = botId ? message.mentions.users.has(botId) : false;
        const mentionByText = botId
          ? message.content.includes(`<@${botId}>`) || message.content.includes(`<@!${botId}>`)
          : false;
        const mentionedBot = mentionByEntity || mentionByText;
        console.info(
          formatLogLine("discord", "inbound", {
            sourceId,
            senderId: message.author.id,
            isGroup,
            threadId: threadId ?? "none",
            mentionedBot,
            content: sanitizeInline(message.content),
          }),
        );

        await this.inboundHandler({
          channelId: "discord",
          sourceId,
          senderId: message.author.id,
          senderName: message.author.globalName ?? message.author.username,
          content: message.content,
          timestamp: Date.now(),
          isGroup,
          threadId,
          // Keep metadata JSON-friendly for store serialization.
          raw: {
            messageId: message.id,
            guildId: message.guildId,
            channelType: message.channel.type,
            mentionedBot,
          },
        });
      });

      await this.client.login(this.token);
      this.connected = true;
      this.lastError = undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : "discord_start_failed";
      if (message.includes("Used disallowed intents")) {
        this.lastError = "discord_disallowed_intents_dm_only_fallback";
        this.degradedDmOnly = true;
        await this.client.destroy();
        this.client = new Client({
          intents: [GatewayIntentBits.DirectMessages],
          partials: [Partials.Channel],
        });
        this.client.on("messageCreate", async (dm: Message) => {
          if (!this.inboundHandler) return;
          if (dm.author?.bot) return;
          if (dm.guildId) return;
          if (!dm.content?.trim()) return;
          console.info(
            formatLogLine("discord", "inbound", {
              sourceId: dm.channel.id,
              senderId: dm.author.id,
              isGroup: false,
              threadId: "none",
              mentionedBot: false,
              content: sanitizeInline(dm.content),
            }),
          );
          await this.inboundHandler({
            channelId: "discord",
            sourceId: dm.channel.id,
            senderId: dm.author.id,
            senderName: dm.author.globalName ?? dm.author.username,
            content: dm.content,
            timestamp: Date.now(),
            isGroup: false,
            raw: {
              messageId: dm.id,
              guildId: dm.guildId,
              channelType: dm.channel.type,
            },
          });
        });
        await this.client.login(this.token);
        this.connected = true;
        return;
      }
      this.connected = false;
      this.lastError = message;
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.client.destroy();
    this.connected = false;
  }

  async send(envelope: OutboundEnvelope): Promise<void> {
    const raw =
      envelope.raw && typeof envelope.raw === "object"
        ? (envelope.raw as { messageId?: unknown; mentionedBot?: unknown })
        : undefined;
    const replyToMessageId = typeof raw?.messageId === "string" ? raw.messageId : undefined;
    const mentionedBot = raw?.mentionedBot === true;
    const threadDecision = getDiscordThreadDecisionReason(Boolean(envelope.threadId), mentionedBot, Boolean(replyToMessageId));
    console.info(
      formatLogLine("discord", "thread_decision", {
        channelId: envelope.sourceId,
        threadId: envelope.threadId ?? "none",
        replyToMessageId: replyToMessageId ?? "none",
        mentionedBot,
        decision: threadDecision,
      }),
    );

    if (threadDecision === "create_thread") {
      const replyToId = replyToMessageId as string;
      const parentChannel = await this.client.channels.fetch(envelope.sourceId);
      if (parentChannel && parentChannel.isTextBased() && "messages" in parentChannel) {
        const channelWithMessages = parentChannel as {
          messages: { fetch: (messageId: string) => Promise<Message> };
          threads?: {
            cache?: { get: (id: string) => { send: (content: string) => Promise<unknown> } | undefined };
            fetchActive?: () => Promise<{
              threads: {
                get: (id: string) => { send: (content: string) => Promise<unknown> } | undefined;
              };
            }>;
          };
        };
        const parentMessage = await channelWithMessages.messages.fetch(replyToId).catch(() => null);
        if (parentMessage && "startThread" in parentMessage && typeof parentMessage.startThread === "function") {
          try {
            const createdThread = await parentMessage.startThread({
              name: `fahrenheit-${Date.now()}`,
              autoArchiveDuration: 60,
            });
            await createdThread.send(envelope.content);
            console.info(
              formatLogLine("discord", "thread_created", {
                channelId: envelope.sourceId,
                messageId: replyToId,
              }),
            );
            return;
          } catch (error) {
            const code = this.getDiscordErrorCode(error);
            if (code === discordThreadErrorCodes.alreadyExists) {
              const existingCached = channelWithMessages.threads?.cache?.get(replyToId);
              if (existingCached) {
                await existingCached.send(envelope.content);
                console.info(
                  formatLogLine("discord", "thread_reused", {
                    source: "cache",
                    channelId: envelope.sourceId,
                    messageId: replyToId,
                  }),
                );
                return;
              }
              const active = channelWithMessages.threads?.fetchActive ? await channelWithMessages.threads.fetchActive().catch(() => null) : null;
              const existingActive = active?.threads.get(replyToId);
              if (existingActive) {
                await existingActive.send(envelope.content);
                console.info(
                  formatLogLine("discord", "thread_reused", {
                    source: "active",
                    channelId: envelope.sourceId,
                    messageId: replyToId,
                  }),
                );
                return;
              }
            }
            this.lastError = this.describeThreadError("discord_thread_create_failed", envelope.sourceId, replyToId, error);
            console.info(
              formatLogLine("discord", "thread_create_failed", {
                channelId: envelope.sourceId,
                messageId: replyToId,
                reason: this.lastError,
              }),
            );
          }
        } else {
          console.info(
            formatLogLine("discord", "thread_skipped", {
              channelId: envelope.sourceId,
              reason: "parent_message_not_found_or_not_threadable",
            }),
          );
        }
      } else {
        console.info(
          formatLogLine("discord", "thread_skipped", {
            channelId: envelope.sourceId,
            reason: "parent_channel_not_text",
          }),
        );
      }
    }

    const targetChannelId = envelope.threadId && envelope.threadId !== envelope.sourceId ? envelope.threadId : envelope.sourceId;
    const channel = await this.client.channels.fetch(targetChannelId);
    if (!channel || !channel.isTextBased() || !("send" in channel)) return;
    if (replyToMessageId && targetChannelId === envelope.sourceId) {
      await channel.send({
        content: envelope.content,
        reply: { messageReference: replyToMessageId },
      });
      console.info(
        formatLogLine("discord", "reply_in_channel", {
          channelId: targetChannelId,
          messageId: replyToMessageId,
        }),
      );
      return;
    }
    await channel.send(envelope.content);
    console.info(
      formatLogLine("discord", "send", {
        channelId: targetChannelId,
        threadId: envelope.threadId ?? "none",
      }),
    );
  }

  private getDiscordErrorCode(error: unknown): number | undefined {
    if (error instanceof DiscordAPIError) return Number(error.code);
    if (typeof error === "object" && error && "code" in error) {
      const code = (error as { code?: unknown }).code;
      return typeof code === "number" ? code : undefined;
    }
    return undefined;
  }

  private describeThreadError(prefix: string, channelId: string, messageId: string, error: unknown): string {
    const code = this.getDiscordErrorCode(error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return describeDiscordThreadError(prefix, channelId, messageId, code, message);
  }

  getSetupSpec(): ProviderSetupSpec {
    return {
      providerId: this.id,
      title: "Discord Bot",
      summary: "Connect a Discord bot token; enable Message Content intent.",
      fields: [
        { key: "gateway.channels.discord.enabled", label: "Enable channel", required: true, example: "true" },
        { key: "gateway.channels.discord.token", label: "Bot token", required: true, secret: true },
      ],
      docsUrl: "https://discord.com/developers/applications",
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
