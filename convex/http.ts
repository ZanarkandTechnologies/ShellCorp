import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { parseIngestPayload, parseStatusReportPayload } from "./status_http_contract";
import { parseBoardCommandPayload, parseBoardQueryPayload } from "./board_http_contract";

const http = httpRouter();

function readAuthHeaders(request: Request): { actorRole: string; allowedPermissions?: string } {
  const actorRole = request.headers.get("x-shellcorp-actor-role")?.trim().toLowerCase() || "operator";
  const allowedPermissions = request.headers.get("x-shellcorp-allowed-permissions")?.trim() || undefined;
  return { actorRole, allowedPermissions };
}

function hasBoardToken(request: Request): boolean {
  const expected = process.env.SHELLCORP_BOARD_OPERATOR_TOKEN?.trim();
  if (!expected) return true;
  const actual = request.headers.get("x-shellcorp-board-token")?.trim();
  return Boolean(actual && actual === expected);
}

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }

    const parsed = parseIngestPayload(body);
    if (!parsed) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    }

    await ctx.runMutation(internal.events.ingestEvent, {
      ...parsed,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

http.route({
  path: "/status/report",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }
    const parsed = parseStatusReportPayload(body);
    if (!parsed) return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    try {
      const result = await ctx.runMutation(internal.events.reportStatus, parsed);
      return new Response(JSON.stringify({ ok: true, duplicate: result.duplicate }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/board/command",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasBoardToken(request)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }
    const parsed = parseBoardCommandPayload(body);
    if (!parsed) return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    try {
      const auth = readAuthHeaders(request);
      const result = await ctx.runMutation(api.board.boardCommand, {
        ...parsed,
        actorType: parsed.command === "activity_log" ? "agent" : "operator",
        actorAgentId: parsed.actorAgentId ?? (parsed.command === "activity_log" ? "agent-unknown" : "operator-http"),
        actorRole: auth.actorRole,
        allowedPermissions: auth.allowedPermissions,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }),
});

http.route({
  path: "/board/query",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!hasBoardToken(request)) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), { status: 403 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
    }
    const parsed = parseBoardQueryPayload(body);
    if (!parsed) return new Response(JSON.stringify({ ok: false, error: "invalid_payload" }), { status: 400 });
    try {
      if (parsed.query === "tasks") {
        const data = await ctx.runQuery(api.board.getProjectBoard, {
          projectId: parsed.projectId,
        });
        return new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (parsed.query === "board_events") {
        const data = await ctx.runQuery(api.board.getProjectBoardEvents, {
          projectId: parsed.projectId,
          limit: parsed.limit,
          taskId: parsed.taskId,
        });
        return new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (parsed.query === "activity") {
        const data = await ctx.runQuery(api.board.getProjectActivity, {
          projectId: parsed.projectId,
          limit: parsed.limit,
          agentId: parsed.agentId,
        });
        return new Response(JSON.stringify({ ok: true, data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const data = await ctx.runQuery(api.board.getNextTaskCandidates, {
        projectId: parsed.projectId,
        limit: parsed.limit,
        agentId: parsed.agentId,
      });
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }),
});

export default http;
