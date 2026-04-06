import { describe, expect, it, vi } from "vitest";
import {
  buildAgentHookPayload,
  extractPlainText,
  handleNotionWebhook,
  isValidNotionSignature,
  normalizeWebhookPayload,
} from "./webhook.js";

describe("notion webhook helpers", () => {
  it("extracts webhook metadata and bot author state", () => {
    const payload = normalizeWebhookPayload({
      type: "comment.created",
      entity: { id: "comment-1" },
      data: {
        page_id: "page-1",
      },
      authors: [{ type: "person" }, { type: "bot" }],
    });

    expect(payload.type).toBe("comment.created");
    expect(payload.commentId).toBe("comment-1");
    expect(payload.pageId).toBe("page-1");
    expect(payload.botAuthored).toBe(true);
  });

  it("extracts plain text from rich text arrays", () => {
    expect(
      extractPlainText([{ plain_text: "@shell " }, { plain_text: "summarize this page" }]),
    ).toBe("@shell summarize this page");
  });

  it("validates Notion signatures against the raw body", async () => {
    const rawBody = JSON.stringify({ type: "comment.created", entity: { id: "comment-1" } });
    const verificationToken = "secret_verify";
    const crypto = await import("node:crypto");
    const signature = `sha256=${crypto.createHmac("sha256", verificationToken).update(rawBody).digest("hex")}`;

    expect(
      isValidNotionSignature({
        rawBody,
        signatureHeader: signature,
        verificationToken,
      }),
    ).toBe(true);
    expect(
      isValidNotionSignature({
        rawBody,
        signatureHeader: "sha256=bad",
        verificationToken,
      }),
    ).toBe(false);
  });
});

describe("handleNotionWebhook", () => {
  it("persists verification tokens from Notion challenges", async () => {
    const persistVerificationToken = vi.fn(async () => true);

    const result = await handleNotionWebhook({
      rawBody: JSON.stringify({ verification_token: "secret_123" }),
      payload: { verification_token: "secret_123" },
      headers: {},
      config: {
        account: {},
      },
      localPort: 18789,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      retrieveComment: vi.fn(async () => ({})),
      persistVerificationToken,
    });

    expect(result.statusCode).toBe(200);
    expect(result.body.verificationTokenSeen).toBe(true);
    expect(persistVerificationToken).toHaveBeenCalledWith("secret_123");
  });

  it("rejects comment events with an invalid signature", async () => {
    const result = await handleNotionWebhook({
      rawBody: JSON.stringify({ type: "comment.created" }),
      payload: { type: "comment.created" },
      headers: {
        "x-notion-signature": "sha256=bad",
      },
      config: {
        verificationToken: "secret_verify",
        account: {},
      },
      localPort: 18789,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      retrieveComment: vi.fn(async () => ({})),
      persistVerificationToken: vi.fn(async () => true),
    });

    expect(result.statusCode).toBe(401);
    expect(result.body.error).toBe("invalid_signature");
  });

  it("skips comments without the wake word", async () => {
    const rawBody = JSON.stringify({
      type: "comment.created",
      entity: { id: "comment-1" },
      data: { page_id: "page-1" },
      authors: [{ type: "person" }],
    });
    const crypto = await import("node:crypto");
    const verificationToken = "secret_verify";
    const signature = `sha256=${crypto.createHmac("sha256", verificationToken).update(rawBody).digest("hex")}`;

    const result = await handleNotionWebhook({
      rawBody,
      payload: JSON.parse(rawBody) as Record<string, unknown>,
      headers: {
        "x-notion-signature": signature,
      },
      config: {
        verificationToken,
        hooksToken: "hook-token",
        account: {
          apiKey: "notion-secret",
          requireWakeWord: true,
          wakeWords: ["@shell"],
        },
      },
      localPort: 18789,
      fetchImpl: vi.fn() as unknown as typeof fetch,
      retrieveComment: vi.fn(async () => ({
        rich_text: [{ plain_text: "hello there" }],
      })),
      persistVerificationToken: vi.fn(async () => true),
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.reason).toBe("wake_word_missing");
  });

  it("retrieves the comment and dispatches accepted messages into hooks/agent", async () => {
    const rawBody = JSON.stringify({
      type: "comment.created",
      entity: { id: "comment-1" },
      data: { page_id: "page-1" },
      authors: [{ type: "person" }],
    });
    const crypto = await import("node:crypto");
    const verificationToken = "secret_verify";
    const signature = `sha256=${crypto.createHmac("sha256", verificationToken).update(rawBody).digest("hex")}`;
    const fetchMock = vi.fn(async (_input: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(payload).toEqual(
        buildAgentHookPayload({
          message: "@shell summarize this page",
          agentId: "main",
          pageId: "page-1",
          commentId: "comment-1",
        }),
      );
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const result = await handleNotionWebhook({
      rawBody,
      payload: JSON.parse(rawBody) as Record<string, unknown>,
      headers: {
        "x-notion-signature": signature,
      },
      config: {
        verificationToken,
        targetAgentId: "main",
        hooksToken: "hook-token",
        hooksPath: "/hooks",
        account: {
          apiKey: "notion-secret",
          requireWakeWord: true,
          wakeWords: ["@shell"],
        },
      },
      localPort: 18789,
      fetchImpl: fetchMock as unknown as typeof fetch,
      retrieveComment: vi.fn(async () => ({
        rich_text: [{ plain_text: "@shell summarize this page" }],
      })),
      persistVerificationToken: vi.fn(async () => true),
    });

    expect(result.statusCode).toBe(202);
    expect(result.body.dispatched).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
