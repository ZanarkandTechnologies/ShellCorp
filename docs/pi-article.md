How to Build a Custom Agent Framework with PI: The Agent Stack Powering OpenClaw
PI is a toolkit for building AI agents. It's a monorepo of packages that layer on top of each other:
pi-ai handles LLM communication across providers
pi-agent-core adds the agent loop with tool calling
pi-coding-agent gives you a full coding agent with built-in tools, session persistence, and extensibility
pi-tui provides a terminal UI for building CLI interfaces.
These are the same packages that power OpenClaw. This guide walks through each layer, progressively building up to a fully featured agent with a terminal UI, session persistence, and custom tools.
By understanding how to compose these layers, you can build production-grade agentic software on your own terms, without being locked into a specific abstraction.
Pi was created by @badlogicgames. This is a great writeup from him that explains some of the design decisions made when creating it. This tutorial involves a lot of code and is therefore also available as markdown here. See more of my writing here.
The stack
┌─────────────────────────────────────────┐
│  Your Agent.                            │
├────────────────────┬────────────────────┤
│  pi-coding-agent   │  pi-tui            │
│  Sessions, tools,  │  Terminal UI,      │
│  extensions        │  markdown, editor  │
├────────────────────┴────────────────────┤
│  pi-agent-core                          │
│  Agent loop, tool execution, events     │
├─────────────────────────────────────────┤
│  pi-ai                                  │
│  Streaming, models, multi-provider LLM  │
└─────────────────────────────────────────┘
Each layer adds capability.
pi-ai - call any LLM through one interface. Anthropic, OpenAI, Google, Bedrock, Mistral, Groq, xAI, OpenRouter, Ollama, and more. Streaming, completions, tool definitions, cost tracking.
pi-agent-core - wraps pi-ai into an agent loop. You define tools, the agent calls the LLM, executes tools, feeds results back, and repeats until done.
pi-coding-agent - the full agent runtime. Built-in file tools (read, write, edit, bash), JSONL session persistence, context compaction, skills, and an extension system.
pi-tui - terminal UI library with differential rendering. Markdown display, multi-line editor with autocomplete, loading spinners, and flicker-free screen updates.
Prerequisites
Node.js 20+
An API key from at least one provider (Anthropic, OpenAI, Google, etc.)
Setup
bash
mkdir pi-agent && cd pi-agent
npm init -y
npm install @mariozechner/pi-ai @mariozechner/pi-agent-core @mariozechner/pi-coding-agent @mariozechner/pi-tui chalk
npm install -D typescript @types/node tsx
Set your API key:
bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
Layer 1: pi-ai
Your first LLM call
Create `basics.ts`:
typescript
import { getModel, completeSimple } from "@mariozechner/pi-ai";

async function main() {
  const model = getModel("anthropic", "claude-opus-4-5");

  const response = await completeSimple(model, {
    systemPrompt: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "What is the capital of France?", timestamp: Date.now() }
    ],
  });

  // response is an AssistantMessage
  for (const block of response.content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }

  console.log(`\nTokens: ${response.usage.totalTokens}`);
  console.log(`Stop reason: ${response.stopReason}`);
}

main();
Run it:
bash
npx tsx basics.ts
`getModel` looks up a model by provider and ID from PI's built-in catalog of 2000+ models. `completeSimple` sends the messages and returns the full `AssistantMessage` when the model is done.
The response has a `.content` array of typed blocks - `text`, `thinking`, or `toolCall` - plus `.usage` for token counts and `.stopReason` for why the model stopped (`"stop"`, `"toolUse"`, `"length"`, `"error"`, `"aborted"`).
Streaming
`completeSimple` waits for the full response. For real-time output, use `streamSimple`:
typescript
import { getModel, streamSimple } from "@mariozechner/pi-ai";

async function main() {
  const model = getModel("anthropic", "claude-opus-4-5");

  const stream = streamSimple(model, {
    systemPrompt: "You are a helpful assistant.",
    messages: [
      { role: "user", content: "Explain how TCP works in 3 sentences.", timestamp: Date.now() }
    ],
  });

  for await (const event of stream) {
    switch (event.type) {
      case "text_delta":
        process.stdout.write(event.delta);
        break;
      case "done":
        console.log(`\n\nTokens: ${event.message.usage.totalTokens}`);
        break;
      case "error":
        console.error("Error:", event.error.errorMessage);
        break;
    }
  }
}

main();
Every provider has its own streaming format - Anthropic, OpenAI, and Google all do it differently. 
`streamSimple` normalizes them into a single set of events: `start`, `text_start`, `text_delta`, `text_end`, `thinking_start/delta/end`, `toolcall_start/delta/end`, `done`, and `error`. 
Write your streaming handler once, and it works with any provider. For most use cases, you only care about `text_delta` (the text chunks) and `done` (the final message).
You can also await the final message directly:
typescript
const stream = streamSimple(model, context);
const finalMessage = await stream.result(); // AssistantMessage
Switching providers
Switch to a different provider by changing the `getModel` call. The rest of your code stays the same.
typescript
// Just change this line - everything else stays the same
const model = getModel("anthropic", "claude-opus-4-5");
// const model = getModel("openai", "gpt-4o");
// const model = getModel("google", "gemini-2.5-pro");
// const model = getModel("groq", "llama-3.3-70b-versatile");

const stream = streamSimple(model, context);
Each provider needs its own API key set in the environment (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, etc.).
You can also define custom models for self-hosted endpoints:
typescript
import type { Model } from "@mariozechner/pi-ai";

const localModel: Model<"openai-completions"> = {
  id: "llama-3.1-8b",
  name: "llama-3.1-8b",
  api: "openai-completions",
  provider: "ollama",
  baseUrl: "http://localhost:11434/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
};
Under the hood, pi-ai uses the official provider SDKs (OpenAI SDK, Anthropic SDK, etc.). The `api` field determines which SDK handles the request - `"openai-completions"` routes through the OpenAI SDK, which is why it works with any OpenAI-compatible endpoint (Ollama, vLLM, Mistral, etc.).
API keys are resolved automatically from environment variables by provider name (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) and passed to the SDK, which handles authentication. Ollama doesn't require auth, so the example above works as-is. For a provider that needs a key, either set the matching environment variable or pass it directly:
typescript
const stream = streamSimple(localModel, context, {
  apiKey: "your-api-key",
});
Thinking levels
Models that support extended thinking (Claude, o3, Gemini 2.5) can be enabled via the `reasoning` option. It's off by default.
typescript
const stream = streamSimple(model, context, {
  reasoning: "high", // "minimal" | "low" | "medium" | "high" | "xhigh"
});
When enabled, the stream emits `thinking_delta` events alongside `text_delta`.
Layer 2: pi-agent-core
pi-ai lets you talk to LLMs. pi-agent-core lets the LLM talk back - with tools.
The `Agent` class runs the standard agent loop: send messages to the LLM, execute any tool calls it makes, feed results back, repeat until the model stops.
Defining tools
Tools use TypeBox schemas for type-safe parameter definitions:
typescript
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const weatherParams = Type.Object({
  city: Type.String({ description: "City name" }),
});

const weatherTool: AgentTool<typeof weatherParams> = {
  name: "get_weather",
  label: "Weather",
  description: "Get the current weather for a city",
  parameters: weatherParams,
  execute: async (toolCallId, params, signal, onUpdate) => {
    // params is typed: { city: string }
    const temp = Math.round(Math.random() * 30);
    return {
      content: [{ type: "text", text: `${params.city}: ${temp}C, partly cloudy` }],
      details: { temp, city: params.city },
    };
  },
};
Define the schema as a standalone variable and pass it as the generic parameter to `AgentTool<typeof schema>` - this gives TypeScript the type information it needs to infer `params` correctly inside `execute`.
Every tool has:
name - identifier the LLM uses to call it
label - human-readable display name
description - tells the LLM when and how to use the tool
parameters - TypeBox schema; validated with AJV before execution
execute - runs when the LLM calls the tool; returns `content` (sent back to the LLM) and `details` (for your UI, not sent to the LLM)
The `onUpdate` callback lets you stream partial results during execution - useful for long-running tools like bash commands.
Creating an agent
Wire up the weather tool from above with a model and a streaming function. We'll add event handling, prompting, and a full working example in the sections that follow.
typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple } from "@mariozechner/pi-ai";

const model = getModel("anthropic", "claude-opus-4-5");

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant with access to tools.",
    model,
    tools: [weatherTool],
    thinkingLevel: "off",
  },
  streamFn: streamSimple,
});
The `Agent` takes an `initialState` (system prompt, model, tools, thinking level) and a `streamFn` - the function that actually calls the LLM. Passing `streamSimple` from pi-ai connects the agent to whatever provider the model specifies.
The event stream
Subscribe to events to see what the agent is doing:
typescript
agent.subscribe((event) => {
  switch (event.type) {
    case "agent_start":
      console.log("Agent started");
      break;

    case "message_update":
      // Streaming text from the LLM
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;

    case "tool_execution_start":
      console.log(`\nTool: ${event.toolName}(${JSON.stringify(event.args)})`);
      break;

    case "tool_execution_end":
      console.log(`Result: ${event.isError ? "ERROR" : "OK"}`);
      break;

    case "agent_end":
      console.log("\nAgent finished");
      break;
  }
});
Full event list: 
typescript
agent_start
agent_end
turn_start
turn_end
message_start
message_update
message_end
tool_execution_start
tool_execution_update
tool_execution_end
Running the agent
typescript
await agent.prompt("What's the weather in Tokyo and London?");
That's it. The agent:
Sends your message to the LLM
The LLM decides to call `get_weather` for Tokyo
The agent executes the tool, feeds the result back
The LLM calls `get_weather` for London
The agent executes again, feeds the result back
The LLM produces a final text response
You didn't write the loop. The agent handles it.
Full example
Here's a complete working agent with two tools:
typescript
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import * as fs from "fs";

const readFileParams = Type.Object({
  path: Type.String({ description: "Path to the file" }),
});

const readFileTool: AgentTool<typeof readFileParams> = {
  name: "read_file",
  label: "Read File",
  description: "Read the contents of a file",
  parameters: readFileParams,
  execute: async (_id, params) => {
    try {
      const content = fs.readFileSync(params.path, "utf-8");
      return {
        content: [{ type: "text", text: content }],
        details: {},
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        details: {},
      };
    }
  },
};

const listFilesParams = Type.Object({
  path: Type.String({ description: "Directory path", default: "." }),
});

const listFilesTool: AgentTool<typeof listFilesParams> = {
  name: "list_files",
  label: "List Files",
  description: "List files in a directory",
  parameters: listFilesParams,
  execute: async (_id, params) => {
    const files = fs.readdirSync(params.path);
    return {
      content: [{ type: "text", text: files.join("\n") }],
      details: { count: files.length },
    };
  },
};

async function main() {
  const model = getModel("anthropic", "claude-opus-4-5");

  const agent = new Agent({
    initialState: {
      systemPrompt: "You can read files and list directories. Be concise.",
      model,
      tools: [readFileTool, listFilesTool],
      thinkingLevel: "off",
    },
    streamFn: streamSimple,
  });

  agent.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
    if (event.type === "tool_execution_start") {
      console.log(`\n[${event.toolName}] ${JSON.stringify(event.args)}`);
    }
  });

  await agent.prompt("What files are in the current directory? Read the package.json if it exists.");
  console.log();
}

main();
Steering and follow-ups
If the agent is working and you want to redirect it:
typescript
// Interrupt: delivered after the current tool finishes.
// Remaining pending tools are skipped.
agent.steer({
  role: "user",
  content: "Actually, skip that and read tsconfig.json instead.",
  timestamp: Date.now(),
});

// Follow-up: queued for after the agent finishes naturally.
// Doesn't interrupt current work.
agent.followUp({
  role: "user",
  content: "Now summarize what you found.",
  timestamp: Date.now(),
});
`steer` interrupts - it skips remaining tools and injects your message. `followUp` waits - it queues the message for after the agent naturally stops. OpenClaw uses steering for real-time user messages (someone typing while the agent works) and follow-ups for programmatic chaining.
State management
You can change the agent's configuration at any time:
typescript
agent.setModel(getModel("openai", "gpt-4o"));  // Switch providers mid-session
agent.setThinkingLevel("high");                // Enable extended thinking
agent.setSystemPrompt("New instructions.");    // Update the system prompt
agent.setTools([...newTools]);                 // Swap the tool set
agent.replaceMessages(trimmedMessages);        // Replace conversation history
The agent picks up changes on the next turn.
Layer 3: pi-coding-agent
pi-agent-core gives you the loop. pi-coding-agent gives you a production-ready agent with built-in tools, session persistence, and extensibility. It's built on top of pi-agent-core - when you use pi-coding-agent, you're already using pi-agent-core under the hood.
Most users should start here and only drop down to pi-agent-core directly if they need a custom agent that doesn't use the built-in coding tools or session system.
Built-in tools
pi-coding-agent has 7 built-in tools. Four are active by default (`codingTools`), three more are available but off by default:
Default tools (active):
markdown
|   Tool   | What it does |
|  `read`  | Read file contents and images (jpg, png, gif, webp). Images are returned as attachments. Text output is truncated to 2000 lines or 50KB. Supports `offset`/`limit` for paginating large files. |
|  `bash`  | Execute a shell command in the working directory. Returns stdout and stderr, truncated to the last 2000 lines or 50KB. Optional `timeout` in seconds. |
|  `edit`  | Replace exact text in a file. `oldText` must match exactly (including whitespace). For precise, surgical edits. |
|  `write` | Write content to a file. Creates it if it doesn't exist, overwrites if it does. Auto-creates parent directories. |
Additional tools (opt-in):
markdown
|   Tool.  | What it does |
|  `grep`  | Search file contents for a regex or literal pattern. Returns matching lines with file paths and line numbers. Respects `.gitignore`. Uses ripgrep under the hood. |
|  `find`  | Search for files by glob pattern. Returns matching paths relative to the search directory. Respects `.gitignore`. |
|  `ls`    | List directory contents. Entries sorted alphabetically with `/` suffix for directories. Includes dotfiles. |
These are organized into presets:
typescript
import { codingTools, readOnlyTools } from "@mariozechner/pi-coding-agent";

codingTools;    // [read, bash, edit, write]  - default
readOnlyTools;  // [read, grep, find, ls]     - exploration without modification
Or select individual tools:
typescript
import { allBuiltInTools } from "@mariozechner/pi-coding-agent";

// allBuiltInTools.read, allBuiltInTools.bash, allBuiltInTools.edit,
// allBuiltInTools.write, allBuiltInTools.grep, allBuiltInTools.find, allBuiltInTools.ls

const { session } = await createAgentSession({
  model,
  tools: [allBuiltInTools.read, allBuiltInTools.bash, allBuiltInTools.grep],
  sessionManager: SessionManager.inMemory(),
});
createAgentSession
`createAgentSession` wires everything together - model, tools, session persistence, settings:
typescript
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";
import { getModel, streamSimple } from "@mariozechner/pi-ai";

async function main() {
  const model = getModel("anthropic", "claude-opus-4-5");

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "off",
    sessionManager: SessionManager.inMemory(),
  });

  session.agent.streamFn = streamSimple;

  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
    if (event.type === "tool_execution_start") {
      console.log(`\n[${event.toolName}]`);
    }
  });

  await session.prompt("What files are in the current directory? Summarize the package.json.");
  console.log();

  session.dispose();
}

main();
That's a working coding agent. It can read your files, run commands, edit code, and write new files. `SessionManager.inMemory()` means the session lives in memory and disappears when the process exits.
Session persistence
For durable sessions, point the SessionManager at a file:
typescript
import * as path from "path";

const sessionFile = path.join(process.cwd(), ".sessions", "my-session.jsonl");
const sessionManager = SessionManager.open(sessionFile);

const { session } = await createAgentSession({
  model,
  sessionManager,
});
Sessions are stored as JSONL files with a tree structure - each entry has an `id` and `parentId`. This enables branching: you can navigate to any previous point in the conversation and continue from there without losing history.
`SessionManager` has several static factory methods. Pick one based on your use case and pass it to `createAgentSession`:
typescript
// Option 1: In-memory (ephemeral, nothing written to disk)
const sessionManager = SessionManager.inMemory();

// Option 2: New persistent session in ~/.pi/agent/sessions/
const sessionManager = SessionManager.create(process.cwd());

// Option 3: Open a specific session file
const sessionManager = SessionManager.open("/path/to/session.jsonl");

// Option 4: Continue the most recent session (or create new if none exists)
const sessionManager = SessionManager.continueRecent(process.cwd());

// Then pass whichever one you chose:
const { session } = await createAgentSession({ model, sessionManager });
You can also list existing sessions for a directory:
typescript
const sessions = await SessionManager.list(process.cwd());
Once you have a `SessionManager`, you rarely need to call its methods directly - `createAgentSession` handles most of the wiring. But if you're building custom session logic (like OpenClaw does for multi-channel routing), these are the key methods:
typescript
// Reconstruct the conversation from the JSONL file.
// Use this when you need to inspect or display the current conversation
// outside of the agent session (e.g., showing history in a web UI).
const { messages, thinkingLevel, model } = sessionManager.buildSessionContext();

// Get the last entry in the current branch.
// Useful for checking what the most recent message was,
// or grabbing an entry ID to branch from.
const leaf = sessionManager.getLeafEntry();

// Fork the conversation from a specific point.
// Everything after entryId is abandoned (but still in the file).
// The agent continues from that point on the next prompt.
// OpenClaw uses this for "retry from here" flows.
sessionManager.branch(entryId);

// Manually append a message to the session transcript.
// createAgentSession does this automatically during prompt(),
// but you'd use it to inject messages programmatically -
// e.g., adding a system notification or a cron-triggered prompt.
sessionManager.appendMessage(message);

// Get the full tree structure of the session.
// Each node has children, so you can render a branch selector
// or let users navigate conversation history.
const tree = sessionManager.getTree();
OpenClaw uses one session file per channel thread - `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl` - so each conversation is independent and crash-safe (JSONL is append-only; you lose at most one line on a crash).
Using tool factories
The pre-built tool arrays like `codingTools` and `readOnlyTools` are singletons that operate on whatever directory your process is running from. If you need tools that operate on a specific directory instead, use the factory functions:
typescript
import {
  createCodingTools,
  createReadOnlyTools,
  createReadTool,
  createBashTool,
  createGrepTool,
} from "@mariozechner/pi-coding-agent";

// Create preset groups scoped to a workspace
const customCodingTools = createCodingTools("/path/to/workspace");       // [read, bash, edit, write]
const customReadOnlyTools = createReadOnlyTools("/path/to/workspace");   // [read, grep, find, ls]

// Or create individual tools - there's a factory for each built-in tool
const customRead = createReadTool("/path/to/workspace");
const customBash = createBashTool("/path/to/workspace");
const customGrep = createGrepTool("/path/to/workspace");
Each factory accepts an optional `operations` object to override the underlying I/O - useful if you want to run tools inside a Docker container, over SSH, or against a virtual filesystem:
typescript
typescript
// Read files from a remote server instead of the local disk
const remoteRead = createReadTool("/workspace", {
  operations: {
    readFile: async (path) => fetchFileFromRemote(path),
    access: async (path) => checkRemoteFileExists(path),
  },
});

// Execute commands in a Docker sandbox instead of the host
const sandboxedBash = createBashTool("/workspace", {
  operations: {
    exec: async (command, cwd, opts) => runInDockerContainer(command, cwd, opts),
  },
});
OpenClaw uses these factories to create workspace-scoped tools for each agent, then wraps them with additional middleware - permission checks, image normalization for the read tool, and Claude Code parameter compatibility aliases (`file_path` → `path`, `old_string` → `oldText`).
Custom tools alongside built-in tools
The built-in tools cover file operations and shell commands.
For anything else - deploying, calling APIs, querying databases - define your own tools and pass them via `customTools`. They'll be available alongside the defaults:
typescript
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const deployParams = Type.Object({
  environment: Type.String({ description: "Target environment", default: "staging" }),
});

const deployTool: AgentTool<typeof deployParams> = {
  name: "deploy",
  label: "Deploy",
  description: "Deploy the application to production",
  parameters: deployParams,
  execute: async (_id, params, signal, onUpdate) => {
    onUpdate?.({
      content: [{ type: "text", text: `Deploying to ${params.environment}...` }],
      details: {},
    });

    // Your logic here - call an API, run a script, trigger a CI pipeline, etc.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      content: [{ type: "text", text: `Deployed to ${params.environment} successfully.` }],
      details: { environment: params.environment, timestamp: Date.now() },
    };
  },
};

const { session } = await createAgentSession({
  model,
  customTools: [deployTool],
  sessionManager: SessionManager.inMemory(),
});
The agent now has read, write, edit, bash *and* deploy.
Compaction
Long conversations exceed the model's context window. pi-coding-agent handles this with compaction - summarizing old messages while keeping recent ones:
typescript
import { estimateTokens } from "@mariozechner/pi-coding-agent";

// Check how many tokens the conversation uses
const totalTokens = session.messages.reduce(
  (sum, msg) => sum + estimateTokens(msg),
  0
);

// Manually trigger compaction - the optional string guides what the summary should preserve
if (totalTokens > 100_000) {
  await session.compact("Preserve all file paths and code changes.");
}
By default, `createAgentSession` enables auto-compaction - it triggers automatically when the context approaches the model's window limit. The full message history stays in the JSONL file; only the in-memory context gets compacted.
Extensions
Tools let the LLM *do things*. Extensions let you modify *how the agent behaves* - without the LLM knowing. They hook into lifecycle events that fire during the agent loop: before messages are sent to the LLM, before compaction runs, when a tool is called, when a session starts. The LLM never sees extensions in its context; they operate behind the scenes.
This is where you put logic like: trimming old tool results so the context window stays focused, replacing the default compaction with a custom summarization pipeline, gating tool calls based on permissions, or injecting extra context based on the current state of the conversation.
An extension is a TypeScript module that exports a function receiving an `ExtensionAPI`:
typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function myExtension(api: ExtensionAPI): void {
  // Fires before every LLM call. Lets you rewrite the message array.
  api.on("context", (event, ctx) => {
    const pruned = event.messages.filter((msg) => {
      // Drop large tool results older than 10 messages
      if (msg.role === "toolResult" && event.messages.indexOf(msg) < event.messages.length - 10) {
        const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
        if (text.length > 5000) return false;
      }
      return true;
    });
    return { messages: pruned };
  });

  // Replace the default compaction with your own summarization logic
  api.on("session_before_compact", async (event, ctx) => {
    const summary = await myCustomSummarize(event.messages);
    return { compaction: { summary, firstKeptEntryId: event.firstKeptEntryId, tokensBefore: event.tokensBefore } };
  });

  // Register a user-facing command (not an LLM tool)
  api.registerCommand("stats", {
    description: "Show session statistics",
    handler: async (_args, ctx) => {
      const stats = ctx.session.getSessionStats();
      console.log(`Messages: ${stats.totalMessages}, Cost: $${stats.cost.toFixed(4)}`);
    },
  });
}
Key extension events include `context` (rewrite messages before the LLM sees them), `session_before_compact` (customize summarization), `tool_call` (intercept or gate tool invocations), `before_agent_start` (inject context or modify the prompt), and `session_start`/`session_switch` (react to session changes).
OpenClaw uses extensions for context pruning (silently trimming oversized tool results to save tokens) and compaction safeguards (replacing pi's default summarization with a multi-stage pipeline that preserves file operation history and tool failure data).
Building something real
Here's a complete example that ties all three layers together: a codebase assistant that can read your project, answer questions, make changes, and remember the conversation across restarts.
Create `assistant.ts`:
typescript
import {
  createAgentSession,
  SessionManager,
  estimateTokens,
} from "@mariozechner/pi-coding-agent";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";

// --- Custom tool: search the web ---
const webSearchParams = Type.Object({
  query: Type.String({ description: "Search query" }),
});

const webSearchTool: AgentTool<typeof webSearchParams> = {
  name: "web_search",
  label: "Web Search",
  description: "Search the web for documentation, error messages, or general information",
  parameters: webSearchParams,
  execute: async (_id, params) => {
    // In production, call a search API (Brave, Serper, etc.)
    return {
      content: [{ type: "text", text: `[Search results for: "${params.query}" would appear here]` }],
      details: { query: params.query },
    };
  },
};

// --- Session persistence ---
const sessionDir = path.join(process.cwd(), ".sessions");
fs.mkdirSync(sessionDir, { recursive: true });

const sessionFile = path.join(sessionDir, "assistant.jsonl");
const sessionManager = SessionManager.open(sessionFile);

// --- Create the agent session ---
async function createAssistant() {
  const model = getModel("anthropic", "claude-opus-4-5");

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "off",
    sessionManager,
    customTools: [webSearchTool],
  });

  session.agent.streamFn = streamSimple;

  return session;
}

// --- Event handler ---
function attachEventHandlers(session: Awaited<ReturnType<typeof createAssistant>>) {
  session.subscribe((event) => {
    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          process.stdout.write(event.assistantMessageEvent.delta);
        }
        break;

      case "tool_execution_start":
        console.log(`\n  [${event.toolName}] ${summarizeArgs(event.args)}`);
        break;

      case "tool_execution_end":
        if (event.isError) {
          console.log(`  ERROR`);
        }
        break;

      case "auto_compaction_start":
        console.log("\n  [compacting context...]");
        break;

      case "agent_end":
        console.log();
        break;
    }
  });
}

function summarizeArgs(args: any): string {
  if (args?.path) return args.path;
  if (args?.command) return args.command.slice(0, 60);
  if (args?.query) return `"${args.query}"`;
  if (args?.pattern) return args.pattern;
  return JSON.stringify(args).slice(0, 60);
}

// --- REPL ---
async function main() {
  const session = await createAssistant();
  attachEventHandlers(session);

  const tokenCount = session.messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);

  console.log("PI Assistant");
  console.log(`  Model: ${session.model?.id}`);
  console.log(`  Session: ${sessionFile}`);
  console.log(`  History: ${session.messages.length} messages, ~${tokenCount} tokens`);
  console.log(`  Tools: ${session.getActiveToolNames().join(", ")}`);
  console.log(`  Type "exit" to quit, "new" to reset session\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();

      if (trimmed === "exit") {
        session.dispose();
        rl.close();
        return;
      }

      if (trimmed === "new") {
        await session.newSession();
        console.log("Session reset.\n");
        ask();
        return;
      }

      if (!trimmed) {
        ask();
        return;
      }

      try {
        await session.prompt(trimmed);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
      }

      ask();
    });
  };

  ask();
}

main();
Run it:
bash
npx tsx assistant.ts
This gives you a persistent coding assistant in ~120 lines. It can read files, run commands, edit code, search the web, and it remembers your conversation across restarts. The session tree in the JSONL file preserves full history even through compaction.
A session looks like:
bash
PI Assistant
  Model: claude-opus-4-5
  Session: /your/project/.sessions/assistant.jsonl
  History: 0 messages, ~0 tokens
  Tools: read, bash, edit, write, web_search

You: What does this project do? Look at the README and main entry point.

  [read] README.md
  [read] src/index.ts

This is a TypeScript library that...

You: Find all TODO comments in the source code.

  [bash] grep -rn "TODO" src/

Found 3 TODOs:
- src/auth.ts:42 - TODO: add token refresh
- src/api.ts:18 - TODO: handle rate limits
- src/index.ts:7 - TODO: add graceful shutdown

You: Fix the token refresh TODO. Implement a proper refresh flow.

  [read] src/auth.ts
  [edit] src/auth.ts

Done. Added a `refreshToken()` function that...
Adapting this for production
OpenClaw takes this same pattern and adds layers for production use:
Multi-provider auth
Instead of a single `ANTHROPIC_API_KEY`, OpenClaw uses `AuthStorage` and `ModelRegistry` to manage credentials across providers and support OAuth flows:
typescript
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create(path.join(agentDir, "auth.json"));
const modelRegistry = new ModelRegistry(authStorage, modelsConfigPath);

const { session } = await createAgentSession({
  authStorage,
  modelRegistry,
  model: modelRegistry.find("ollama", "llama3.1:8b"),
  // ...
});
`AuthStorage` reads from an `auth.json` file - a flat object keyed by provider name, where each value is either an API key or an OAuth credential:
json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "devin": { "type": "api_key", "key": "cog_..." },
  "github-copilot": {
    "type": "oauth",
    "refresh": "gho_xxxxxxxxxxxx",
    "access": "ghu_yyyyyyyyyyyy",
    "expires": 1700000000000
  }
}
The `key` field can be a literal value, an environment variable name, or a shell command prefixed with `!` (e.g., `"!op read 'op://vault/openai/key'"` for 1Password). OAuth tokens are auto-refreshed when expired.
`ModelRegistry` reads from a `models.json` file that defines custom providers and models. This is how you add self-hosted models or providers that aren't built into pi:
json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    },
    "my-company-api": {
      "baseUrl": "https://llm.internal.company.com/v1",
      "api": "openai-completions",
      "apiKey": "COMPANY_LLM_KEY",
      "authHeader": true,
      "models": [
        { "id": "internal-model-v2" }
      ]
    }
  }
}
Models defined here show up alongside the built-in catalog. `modelRegistry.find("ollama", "llama3.1:8b")` returns a fully typed `Model` you can pass to `createAgentSession`.
Stream middleware
`session.agent.streamFn` is the function the agent calls every time it needs to talk to an LLM. By default it's `streamSimple`, but you can wrap it to inject headers, tweak parameters, or add logging on a per-provider basis.
OpenClaw uses this to add OpenRouter attribution headers and enable Anthropic prompt caching:
typescript
import { streamSimple } from "@mariozechner/pi-ai";
import type { StreamFn } from "@mariozechner/pi-agent-core";

const wrappedStreamFn: StreamFn = (model, context, options) => {
  const extraHeaders: Record<string, string> = {};

  // OpenRouter uses these for their public app rankings/leaderboard
  if (model.provider === "openrouter") {
    extraHeaders["X-Title"] = "My App";
    extraHeaders["HTTP-Referer"] = "https://myapp.com";
  }

  return streamSimple(model, context, {
    ...options,
    headers: { ...options?.headers, ...extraHeaders },
    cacheRetention: model.provider === "anthropic" ? "long" : "none",
  });
};

session.agent.streamFn = wrappedStreamFn;
Tool customization
The default built-in tools operate on `process.cwd()`, which is fine for a local CLI.
But in a multi-user product like OpenClaw, each agent session needs to be locked to a specific workspace directory so users can't read or write outside their project. OpenClaw uses the tool factories to rebuild the file tools with a workspace root, keeping the same tool behavior but scoping all paths:
typescript
import {
  codingTools,
  readTool,
  createReadTool,
  createWriteTool,
  createEditTool,
} from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";

function buildTools(workspace: string): AgentTool[] {
  return (codingTools as AgentTool[]).map((tool) => {
    if (tool.name === readTool.name) {
      return createReadTool(workspace);
    }
    if (tool.name === "write") {
      return createWriteTool(workspace);
    }
    if (tool.name === "edit") {
      return createEditTool(workspace);
    }
    return tool; // bash stays as-is
  });
}
Event routing
When the agent runs, it emits events - text tokens streaming in, tool calls starting and finishing, the agent completing its turn. In a terminal app, you'd just print these to stdout.
But OpenClaw runs agents on behalf of users who are chatting via Telegram, Discord, or Slack, so it needs to translate these events into platform-specific messages. `session.subscribe()` gives you a callback for every event, and you decide what to do with each one:
typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        // Tokens arrive one at a time - buffer them, then send as one message
        messageBuffer.append(event.assistantMessageEvent.delta);
      }
      break;

    case "tool_execution_start":
      // Send tool call notification to the channel
      channel.sendNotification(`Running ${event.toolName}...`);
      break;

    case "agent_end":
      // Flush remaining buffered text
      messageBuffer.flush();
      break;
  }
});
Adding a terminal UI
The `assistant.ts` example uses `readline` for input - it works, but you get no markdown rendering, no autocomplete, and raw `process.stdout.write` for streaming. `pi-tui` replaces all of that with a proper terminal UI: markdown with syntax highlighting, an editor with slash command and file path autocomplete, a loading spinner, and flicker-free differential rendering.
Here's the same assistant upgraded to pi-tui. Create `assistant-tui.ts`:
typescript
import {
  createAgentSession,
  SessionManager,
  estimateTokens,
} from "@mariozechner/pi-coding-agent";
import { getModel, streamSimple } from "@mariozechner/pi-ai";
import { Type } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  TUI,
  ProcessTerminal,
  Editor,
  Markdown,
  Text,
  Loader,
  CombinedAutocompleteProvider,
} from "@mariozechner/pi-tui";
import type { EditorTheme, MarkdownTheme } from "@mariozechner/pi-tui";
import chalk from "chalk";
import * as path from "path";
import * as fs from "fs";

// --- Themes ---
const markdownTheme: MarkdownTheme = {
  heading: (s) => chalk.bold.cyan(s),
  link: (s) => chalk.blue(s),
  linkUrl: (s) => chalk.dim(s),
  code: (s) => chalk.yellow(s),
  codeBlock: (s) => chalk.green(s),
  codeBlockBorder: (s) => chalk.dim(s),
  quote: (s) => chalk.italic(s),
  quoteBorder: (s) => chalk.dim(s),
  hr: (s) => chalk.dim(s),
  listBullet: (s) => chalk.cyan(s),
  bold: (s) => chalk.bold(s),
  italic: (s) => chalk.italic(s),
  strikethrough: (s) => chalk.strikethrough(s),
  underline: (s) => chalk.underline(s),
};

const editorTheme: EditorTheme = {
  borderColor: (s) => chalk.dim(s),
  selectList: {
    selectedPrefix: (s) => chalk.blue(s),
    selectedText: (s) => chalk.bold(s),
    description: (s) => chalk.dim(s),
    scrollInfo: (s) => chalk.dim(s),
    noMatch: (s) => chalk.dim(s),
  },
};

// --- Custom tool ---
const webSearchParams = Type.Object({
  query: Type.String({ description: "Search query" }),
});

const webSearchTool: AgentTool<typeof webSearchParams> = {
  name: "web_search",
  label: "Web Search",
  description: "Search the web for documentation, error messages, or general information",
  parameters: webSearchParams,
  execute: async (_id, params) => ({
    content: [{ type: "text", text: `[Search results for: "${params.query}" would appear here]` }],
    details: { query: params.query },
  }),
};

// --- Session persistence ---
const sessionDir = path.join(process.cwd(), ".sessions");
fs.mkdirSync(sessionDir, { recursive: true });
const sessionFile = path.join(sessionDir, "assistant.jsonl");

// --- TUI setup ---
const tui = new TUI(new ProcessTerminal());

tui.addChild(new Text(chalk.bold("PI Assistant") + chalk.dim(" (Ctrl+C to exit)\n")));

const editor = new Editor(tui, editorTheme);
editor.setAutocompleteProvider(
  new CombinedAutocompleteProvider(
    [
      { name: "new", description: "Reset the session" },
      { name: "exit", description: "Quit the assistant" },
    ],
    process.cwd(),
  ),
);
tui.addChild(editor);
tui.setFocus(editor);

// --- Main ---
async function main() {
  const model = getModel("anthropic", "claude-opus-4-5");
  const sessionManager = SessionManager.open(sessionFile);

  const { session } = await createAgentSession({
    model,
    thinkingLevel: "off",
    sessionManager,
    customTools: [webSearchTool],
  });

  session.agent.streamFn = streamSimple;

  // Show session info
  const tokenCount = session.messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
  const children = tui.children;
  children.splice(children.length - 1, 0, new Text(
    chalk.dim(`  Model: ${model.id}\n`) +
    chalk.dim(`  Session: ${sessionFile}\n`) +
    chalk.dim(`  History: ${session.messages.length} messages, ~${tokenCount} tokens\n`) +
    chalk.dim(`  Tools: ${session.getActiveToolNames().join(", ")}\n`),
  ));
  tui.requestRender();

  // Streaming state
  let streamingMarkdown: Markdown | null = null;
  let streamingText = "";
  let loader: Loader | null = null;
  let isRunning = false;

  // Subscribe to agent events
  session.subscribe((event) => {
    switch (event.type) {
      case "agent_start":
        isRunning = true;
        editor.disableSubmit = true;
        loader = new Loader(tui, (s) => chalk.cyan(s), (s) => chalk.dim(s), "Thinking...");
        children.splice(children.length - 1, 0, loader);
        tui.requestRender();
        break;

      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta") {
          // Remove loader on first text
          if (loader) {
            tui.removeChild(loader);
            loader = null;
          }
          // Create or update the streaming markdown component
          streamingText += event.assistantMessageEvent.delta;
          if (!streamingMarkdown) {
            streamingMarkdown = new Markdown(streamingText, 1, 0, markdownTheme);
            children.splice(children.length - 1, 0, streamingMarkdown);
          } else {
            streamingMarkdown.setText(streamingText);
          }
          tui.requestRender();
        }
        break;

      case "tool_execution_start": {
        if (loader) {
          tui.removeChild(loader);
          loader = null;
        }
        const args = event.args?.path || event.args?.command?.slice(0, 60) || event.args?.query || "";
        const toolMsg = new Text(chalk.dim(`  [${event.toolName}] ${args}`));
        children.splice(children.length - 1, 0, toolMsg);
        tui.requestRender();
        break;
      }

      case "agent_end":
        if (loader) {
          tui.removeChild(loader);
          loader = null;
        }
        streamingMarkdown = null;
        streamingText = "";
        isRunning = false;
        editor.disableSubmit = false;
        tui.requestRender();
        break;
    }
  });

  // Handle input submission
  editor.onSubmit = async (value: string) => {
    if (isRunning) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    if (trimmed === "/exit") {
      session.dispose();
      tui.stop();
      process.exit(0);
    }

    if (trimmed === "/new") {
      await session.newSession();
      children.splice(2, children.length - 3); // Keep header, info, and editor
      children.splice(children.length - 1, 0, new Text(chalk.dim("  Session reset.\n")));
      tui.requestRender();
      return;
    }

    // Add user message to chat
    const userMsg = new Markdown(value, 1, 0, markdownTheme, (s) => chalk.bold(s));
    children.splice(children.length - 1, 0, userMsg);
    tui.requestRender();

    // Send to agent
    try {
      await session.prompt(trimmed);
    } catch (err: any) {
      children.splice(children.length - 1, 0, new Text(chalk.red(`Error: ${err.message}`)));
      editor.disableSubmit = false;
      tui.requestRender();
    }
  };

  tui.start();
}

main();
Run it:
bash
npx tsx assistant-tui.ts
The key differences from the `readline` version:
Markdown rendering. Agent responses render with syntax-highlighted code blocks, bold, italics, lists, and links - instead of raw text dumped to stdout.
Streaming via `setText`. As tokens arrive, we append to a string and call `streamingMarkdown.setText()`. The TUI's differential renderer updates only the changed lines - no flicker, no screen clearing.
Editor with autocomplete. Type `/` and you get a dropdown of slash commands. Press `Tab` for file path completion. Multi-line input with `Shift+Enter`.
Loading spinner. The `Loader` component shows an animated spinner while the agent thinks, then removes itself when text starts streaming.
No manual cursor management. The TUI handles terminal state, cursor positioning, and cleanup. No `process.stdout.write` calls scattered through your event handler.
The architecture is the same - `createAgentSession` + `session.subscribe()` + `session.prompt()`. The only change is *how* you render the events: instead of writing to stdout, you add and update `Markdown`, `Text`, and `Loader` components in the TUI's component tree.
What's next
This guide covered the four packages you need to build a terminal-based agent.
The remaining pi-mono packages extend the system in other directions:
pi-web-ui - Lit web components for browser-based chat interfaces. Drop-in `ChatPanel` component with streaming, file attachments, and artifact rendering (HTML/SVG/Markdown in sandboxed iframes).
pi-mom - A Slack bot that delegates messages to pi-coding-agent. Per-channel agent isolation, Docker sandboxing, scheduled events, and self-managing tool installation.
pi-pods - CLI for deploying open-source models on GPU pods via vLLM. Supports DataCrunch, RunPod, Vast.ai, and bare metal. Each deployed model exposes an OpenAI-compatible endpoint that pi-ai can consume.
The pi-coding-agent docs cover the full extension API, skills system, and CLI usage. The pi-mono AGENTS.md has detailed instructions for adding new LLM providers.
If you're interested in something even lower level, check out my previous post - You Could've Invented OpenClaw.