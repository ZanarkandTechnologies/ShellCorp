import { describe, expect, it } from "vitest";
import { formatWorkingOutput, mapHistoryMessageToLocal } from "../chat-message-utils";

describe("mapHistoryMessageToLocal", () => {
    it("preserves thinking and multiple tool calls as separate working-output rows", () => {
        const createdAt = 1772942836;
        const messages = mapHistoryMessageToLocal(
            {
                role: "assistant",
                created_at: createdAt,
                content: [
                    {
                        type: "thinking",
                        thinking: "Plan the next two shell commands.",
                        thinkingSignature: '{"id":"rs_123","type":"reasoning","encrypted_content":"abc","summary":["step one"]}',
                    },
                    { type: "toolCall", name: "exec", arguments: { command: "pwd" } },
                    { type: "toolCall", name: "exec", arguments: { command: "ls" } },
                    { type: "text", text: "Done." },
                ],
            },
            0,
        );

        expect(messages).toHaveLength(4);
        expect(messages[0]?.parts?.[0]).toMatchObject({
            kind: "thinking",
            text: "Plan the next two shell commands.",
            signatureId: "rs_123",
            encrypted: true,
            summary: ["step one"],
        });
        expect(messages[1]?.parts?.[0]).toMatchObject({
            kind: "tool",
            toolName: "exec",
            state: "input-available",
            input: { command: "pwd" },
        });
        expect(messages[2]?.parts?.[0]).toMatchObject({
            kind: "tool",
            toolName: "exec",
            state: "input-available",
            input: { command: "ls" },
        });
        expect(messages[3]).toMatchObject({
            kind: undefined,
            text: "Done.",
        });
    });

    it("maps tool results into structured output rows", () => {
        const messages = mapHistoryMessageToLocal(
            {
                role: "toolResult",
                created_at: 1772942836,
                toolName: "exec",
                content: [{ type: "text", text: "file-a\nfile-b" }],
            },
            1,
        );

        expect(messages).toHaveLength(1);
        expect(messages[0]).toMatchObject({
            kind: "working_output",
            text: "[tool:result] exec - Result: file-a\nfile-b",
        });
        expect(messages[0]?.parts?.[0]).toMatchObject({
            kind: "tool",
            toolName: "exec",
            state: "output-available",
            output: "file-a\nfile-b",
        });
    });
});

describe("formatWorkingOutput", () => {
    it("converts tool lifecycle events into structured call/result rows", () => {
        const toolProgress = new Map();
        const start = formatWorkingOutput(
            {
                runId: "run-1",
                sessionKey: "agent:main:main",
                stream: "tool",
                seq: 1,
                data: {
                    phase: "start",
                    toolCallId: "tool-1",
                    name: "exec",
                    args: { command: "pwd" },
                },
            },
            toolProgress,
        );
        const result = formatWorkingOutput(
            {
                runId: "run-1",
                sessionKey: "agent:main:main",
                stream: "tool",
                seq: 2,
                data: {
                    phase: "result",
                    toolCallId: "tool-1",
                    name: "exec",
                    result: { text: "/tmp/workspace" },
                },
            },
            toolProgress,
        );

        expect(start?.parts?.[0]).toMatchObject({
            kind: "tool",
            toolName: "exec",
            state: "input-available",
            input: { command: "pwd" },
        });
        expect(result?.parts?.[0]).toMatchObject({
            kind: "tool",
            toolName: "exec",
            state: "output-available",
            input: "pwd",
            output: { text: "/tmp/workspace" },
        });
    });
});
