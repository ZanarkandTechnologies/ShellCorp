import { z } from "zod";

const skillConfigSchema = z.object({
  path: z.string(),
});

const channelCommonSchema = z.object({
  enabled: z.boolean().default(false),
  allowFrom: z.array(z.string()).default([]),
  agentId: z.string().optional(),
});

export const bahamutConfigSchema = z.object({
  workspaceDir: z.string().default("./workspace"),
  dataDir: z.string().default("~/.bahamut"),
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
      whatsapp: channelCommonSchema.default({ enabled: false, allowFrom: [] }),
    })
    .default({
      telegram: { enabled: false, allowFrom: [] },
      discord: { enabled: false, allowFrom: [] },
      slack: { enabled: false, allowFrom: [] },
      whatsapp: { enabled: false, allowFrom: [] },
    }),
  skills: z.array(skillConfigSchema).default([]),
  logSink: z.enum(["file", "console", "convex"]).default("file"),
});

export type BahamutConfig = z.infer<typeof bahamutConfigSchema>;
