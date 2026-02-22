import { z } from "zod";

const skillConfigSchema = z.object({
  path: z.string(),
});

const channelCommonSchema = z.object({
  enabled: z.boolean().default(false),
  allowFrom: z.array(z.string()).default([]),
  agentId: z.string().optional(),
});

const providerSchema = z.object({
  enabled: z.boolean().default(true),
  allowFrom: z.array(z.string()).default([]),
  mode: z.enum(["conversational", "observational"]).default("observational"),
});

export const fahrenheitConfigSchema = z.object({
  workspaceDir: z.string().default("./workspace"),
  dataDir: z.string().default("~/.fahrenheit"),
  brainAgentId: z.string().default("brain"),
  heartbeat: z
    .object({
      enabled: z.boolean().default(true),
      intervalMinutes: z.number().int().positive().default(30),
      promptPath: z.string().default("HEARTBEAT.md"),
    })
    .default({
      enabled: true,
      intervalMinutes: 30,
      promptPath: "HEARTBEAT.md",
    }),
  channels: z
    .object({
      telegram: channelCommonSchema
        .extend({
          botToken: z.string().optional(),
        })
        .default({ enabled: false, allowFrom: [] }),
      discord: channelCommonSchema
        .extend({
          token: z.string().optional(),
        })
        .default({ enabled: false, allowFrom: [] }),
      slack: channelCommonSchema
        .extend({
          botToken: z.string().optional(),
          appToken: z.string().optional(),
        })
        .default({ enabled: false, allowFrom: [] }),
      whatsapp: channelCommonSchema
        .extend({
          authDir: z.string().optional(),
          printQr: z.boolean().default(true),
        })
        .default({ enabled: false, allowFrom: [], printQr: true }),
    })
    .default({
      telegram: { enabled: false, allowFrom: [] },
      discord: { enabled: false, allowFrom: [] },
      slack: { enabled: false, allowFrom: [] },
      whatsapp: { enabled: false, allowFrom: [], printQr: true },
    }),
  providers: z.record(z.string(), providerSchema).default({}),
  gateway: z
    .object({
      host: z.string().default("127.0.0.1"),
      port: z.number().int().positive().default(8787),
      ingestToken: z.string().optional(),
    })
    .default({
      host: "127.0.0.1",
      port: 8787,
    }),
  convex: z
    .object({
      enabled: z.boolean().default(false),
      deploymentUrl: z.string().optional(),
      authToken: z.string().optional(),
    })
    .default({
      enabled: false,
    }),
  skills: z.array(skillConfigSchema).default([]),
  logSink: z.enum(["file", "console", "convex"]).default("file"),
});

export type FahrenheitConfig = z.infer<typeof fahrenheitConfigSchema>;
