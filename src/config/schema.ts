import { z } from "zod";

const aiProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  apiBase: z.string().nullable().optional(),
  extraHeaders: z.record(z.string(), z.string()).nullable().optional(),
});

const runtimeSchema = z
  .object({
    workspaceDir: z.string().default("./workspace"),
    dataDir: z.string().default("~/.fahrenheit"),
    ai: z
      .object({
        enabled: z.boolean().default(true),
        providers: z.record(z.string(), aiProviderConfigSchema).default({}),
        defaultModel: z.string().default("anthropic/claude-opus-4-5"),
      })
      .default({
        enabled: true,
        providers: {},
        defaultModel: "anthropic/claude-opus-4-5",
      }),
    agent: z
      .object({
        maxTokens: z.number().int().positive().default(8192),
        temperature: z.number().min(0).max(2).default(0.7),
        maxToolIterations: z.number().int().positive().default(20),
        memoryWindow: z.number().int().positive().default(50),
        busyPolicy: z.enum(["queue", "steer"]).default("queue"),
        personalSessionKey: z.string().default("group:personal:cli:dm:local"),
        mockReply: z.string().default(""),
      })
      .default({
        maxTokens: 8192,
        temperature: 0.7,
        maxToolIterations: 20,
        memoryWindow: 50,
        busyPolicy: "queue",
        personalSessionKey: "group:personal:cli:dm:local",
        mockReply: "",
      }),
    heartbeat: z
      .object({
        enabled: z.boolean().default(true),
        intervalMinutes: z.number().int().positive().default(30),
        promptPath: z.string().default("HEARTBEAT.md"),
        sessionKey: z.string().default("runtime:main"),
      })
      .default({
        enabled: true,
        intervalMinutes: 30,
        promptPath: "HEARTBEAT.md",
        sessionKey: "runtime:main",
      }),
    cron: z
      .object({
        storePath: z.string().optional(),
        runsPath: z.string().optional(),
      })
      .default({}),
    memory: z
      .object({
        autoPromoteTrust: z.array(z.enum(["trusted", "untrusted", "system"])).default(["trusted", "system"]),
        compression: z
          .object({
            maxLines: z.number().int().positive().default(2000),
            maxBytes: z.number().int().positive().default(2_000_000),
            minAgeMinutes: z.number().int().positive().default(60),
            keepLastLines: z.number().int().positive().default(400),
            snapshotDir: z.string().default(".memory/history-snapshots"),
          })
          .default({
            maxLines: 2000,
            maxBytes: 2_000_000,
            minAgeMinutes: 60,
            keepLastLines: 400,
            snapshotDir: ".memory/history-snapshots",
          }),
      })
      .default({
        autoPromoteTrust: ["trusted", "system"],
        compression: {
          maxLines: 2000,
          maxBytes: 2_000_000,
          minAgeMinutes: 60,
          keepLastLines: 400,
          snapshotDir: ".memory/history-snapshots",
        },
      }),
  })
  .default({
    workspaceDir: "./workspace",
    dataDir: "~/.fahrenheit",
    ai: {
      enabled: true,
      providers: {},
      defaultModel: "anthropic/claude-opus-4-5",
    },
    agent: {
      maxTokens: 8192,
      temperature: 0.7,
      maxToolIterations: 20,
      memoryWindow: 50,
      busyPolicy: "queue",
      personalSessionKey: "group:personal:cli:dm:local",
      mockReply: "",
    },
    heartbeat: {
      enabled: true,
      intervalMinutes: 30,
      promptPath: "HEARTBEAT.md",
      sessionKey: "runtime:main",
    },
    cron: {},
    memory: {
      autoPromoteTrust: ["trusted", "system"],
      compression: {
        maxLines: 2000,
        maxBytes: 2_000_000,
        minAgeMinutes: 60,
        keepLastLines: 400,
        snapshotDir: ".memory/history-snapshots",
      },
    },
  });

const channelCommonSchema = z.object({
  enabled: z.boolean().default(false),
});

const gatewayGroupSourceSchema = z
  .object({
    channel: z.string(),
    scope: z.enum(["dm", "group", "comments", "all"]).optional(),
    channelIds: z.array(z.string()).default([]),
  })
  .default({
    channel: "custom",
    scope: "all",
    channelIds: [],
  });

const gatewayGroupSchema = z.object({
  description: z.string().default(""),
  allowFrom: z.array(z.string()).default(["*"]),
  mode: z.enum(["conversational", "observational"]).default("conversational"),
  busyPolicy: z.enum(["queue", "steer"]).default("queue"),
  sources: z.array(gatewayGroupSourceSchema).min(1),
});

const gatewayChannelsSchema = z
  .object({
    telegram: channelCommonSchema
      .extend({
        botToken: z.string().optional(),
      })
      .default({ enabled: false }),
    discord: channelCommonSchema
      .extend({
        token: z.string().optional(),
      })
      .default({ enabled: false }),
    slack: channelCommonSchema
      .extend({
        botToken: z.string().optional(),
        appToken: z.string().optional(),
      })
      .default({ enabled: false }),
    whatsapp: channelCommonSchema
      .extend({
        authDir: z.string().optional(),
        printQr: z.boolean().default(true),
      })
      .default({ enabled: false, printQr: true }),
    notion: channelCommonSchema
      .extend({
        apiKey: z.string().optional(),
        workspaceId: z.string().optional(),
        pageIds: z.array(z.string()).default([]),
        pollIntervalMs: z.number().int().positive().default(30000),
        webhookEnabled: z.boolean().default(false),
        webhookPath: z.string().default("/webhooks/notion"),
        approveWebhookPath: z.string().default("/webhook/notion/approve"),
        webhookVerificationToken: z.string().optional(),
        requireWakeWord: z.boolean().default(true),
        wakeWords: z.array(z.string()).default(["@fahrenheit"]),
      })
      .default({
        enabled: false,
        pageIds: [],
        pollIntervalMs: 30000,
        webhookEnabled: false,
        webhookPath: "/webhooks/notion",
        approveWebhookPath: "/webhook/notion/approve",
        requireWakeWord: true,
        wakeWords: ["@fahrenheit"],
      }),
    custom: channelCommonSchema
      .extend({
        ingestPath: z.string().default("/ingest"),
      })
      .default({ enabled: true, ingestPath: "/ingest" }),
  })
  .default({
    telegram: { enabled: false },
    discord: { enabled: false },
    slack: { enabled: false },
    whatsapp: { enabled: false, printQr: true },
    notion: {
      enabled: false,
      pageIds: [],
      pollIntervalMs: 30000,
      webhookEnabled: false,
      webhookPath: "/webhooks/notion",
      approveWebhookPath: "/webhook/notion/approve",
      requireWakeWord: true,
      wakeWords: ["@fahrenheit"],
    },
    custom: { enabled: true, ingestPath: "/ingest" },
  });

const gatewaySinkSchema = z.object({
  type: z.enum(["memory", "file", "convex"]).default("memory"),
  memoryMaxEntries: z.number().int().positive().default(10000),
  filePath: z.string().optional(),
  convex: z
    .object({
      deploymentUrl: z.string().optional(),
      authToken: z.string().optional(),
    })
    .optional(),
});

const gatewaySchema = z
  .object({
    server: z
      .object({
        host: z.string().default("127.0.0.1"),
        bind: z.enum(["loopback", "lan", "custom"]).default("loopback"),
        customBindHost: z.string().optional(),
        port: z.number().int().positive().default(8787),
        ingestToken: z.string().optional(),
      })
      .default({
        host: "127.0.0.1",
        bind: "loopback",
        port: 8787,
      }),
    tools: z
      .object({
        allow: z.array(z.string()).default([]),
        deny: z.array(z.string()).default([]),
      })
      .default({
        allow: [],
        deny: [],
      }),
    channels: gatewayChannelsSchema,
    groups: z.record(z.string(), gatewayGroupSchema).default({}),
    sink: gatewaySinkSchema.default({
      type: "memory",
      memoryMaxEntries: 10000,
    }),
    logSink: z.enum(["file", "console", "convex"]).default("file"),
  })
  .default({
    server: {
      host: "127.0.0.1",
      bind: "loopback",
      port: 8787,
    },
    tools: {
      allow: [],
      deny: [],
    },
    channels: {
      telegram: { enabled: false },
      discord: { enabled: false },
      slack: { enabled: false },
      whatsapp: { enabled: false, printQr: true },
      notion: {
        enabled: false,
        pageIds: [],
        pollIntervalMs: 30000,
        webhookEnabled: false,
        webhookPath: "/webhooks/notion",
        approveWebhookPath: "/webhook/notion/approve",
        requireWakeWord: true,
        wakeWords: ["@fahrenheit"],
      },
      custom: { enabled: true, ingestPath: "/ingest" },
    },
    groups: {},
    sink: {
      type: "memory",
      memoryMaxEntries: 10000,
    },
    logSink: "file",
  });

const ontologyEntityConfigSchema = z.object({
  accessInstructions: z.string().optional(),
  databaseId: z.string().optional(),
  databaseNameHint: z.string().optional(),
  titleField: z.string().optional(),
  statusField: z.string().optional(),
  summaryField: z.string().optional(),
  ownerField: z.string().optional(),
  dueDateField: z.string().optional(),
  tagsField: z.string().optional(),
  priorityField: z.string().optional(),
  valueField: z.string().optional(),
  currencyField: z.string().optional(),
});

const pollingSchema = z
  .object({
    enabled: z.boolean().default(false),
    schedule: z.string().default("0 9 * * *"),
    prompt: z.string().default("Pull latest updates from this source and extract observational memory."),
    sessionKey: z.string().default("runtime:main"),
  })
  .default({
    enabled: false,
    schedule: "0 9 * * *",
    prompt: "Pull latest updates from this source and extract observational memory.",
    sessionKey: "runtime:main",
  });

const ontologyConnectorSchema = z
  .object({
    enabled: z.boolean().default(false),
    workspaceName: z.string().default("default"),
    description: z.string().default(""),
    projectTags: z.array(z.string()).default([]),
    roleTags: z.array(z.string()).default([]),
    trustClass: z.enum(["trusted", "untrusted", "system"]).default("trusted"),
    apiKey: z.string().optional(),
    entities: z
      .object({
        task: ontologyEntityConfigSchema.default({}),
        project: ontologyEntityConfigSchema.default({}),
        goal: ontologyEntityConfigSchema.default({}),
        crmRecord: ontologyEntityConfigSchema.default({}),
      })
      .default({
        task: {},
        project: {},
        goal: {},
        crmRecord: {},
      }),
    polling: pollingSchema,
  })
  .default({
    enabled: false,
    workspaceName: "default",
    description: "",
    projectTags: [],
    roleTags: [],
    trustClass: "trusted",
    entities: {
      task: {},
      project: {},
      goal: {},
      crmRecord: {},
    },
    polling: {
      enabled: false,
      schedule: "0 9 * * *",
      prompt: "Pull latest updates from this source and extract observational memory.",
      sessionKey: "runtime:main",
    },
  });

const ontologySchema = z
  .object({
    enabled: z.boolean().default(false),
    writeMinConfidence: z.number().min(0).max(1).default(0.85),
    connectors: z.record(z.string(), ontologyConnectorSchema).default({}),
  })
  .default({
    enabled: false,
    writeMinConfidence: 0.85,
    connectors: {},
  });

export const fahrenheitConfigSchema = z.object({
  runtime: runtimeSchema,
  gateway: gatewaySchema,
  ontology: ontologySchema,
});

export type FahrenheitConfig = z.infer<typeof fahrenheitConfigSchema>;

export const sensitiveConfigPaths: string[] = [
  "runtime.ai.providers.anthropic.apiKey",
  "runtime.ai.providers.openai.apiKey",
  "runtime.ai.providers.openrouter.apiKey",
  "runtime.ai.providers.groq.apiKey",
  "runtime.ai.providers.gemini.apiKey",
  "gateway.channels.telegram.botToken",
  "gateway.channels.discord.token",
  "gateway.channels.slack.botToken",
  "gateway.channels.slack.appToken",
  "gateway.channels.notion.apiKey",
  "gateway.channels.notion.webhookVerificationToken",
  "gateway.server.ingestToken",
  "gateway.sink.convex.authToken",
  "ontology.connectors.notion.apiKey",
];
