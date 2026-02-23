import { Command } from "commander";

const program = new Command();

program.name("fahrenheit").description("Fahrenheit CLI");

program
  .command("gateway")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const { gatewayCommand } = await import("./commands/gateway.js");
    await gatewayCommand(options.config);
  });

program
  .command("agent")
  .requiredOption("--message <text>", "Message for brain session")
  .option("--config <path>", "Path to config file")
  .action(async (options: { message: string; config?: string }) => {
    const { agentCommand } = await import("./commands/agent.js");
    await agentCommand(options.message, options.config);
  });

program
  .command("tui")
  .option("--config <path>", "Path to config file")
  .option("--session <key>", "Override personal session key")
  .action(async (options: { config?: string; session?: string }) => {
    const { tuiCommand } = await import("./commands/tui.js");
    await tuiCommand(options.config, options.session);
  });

program
  .command("status")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const { statusCommand } = await import("./commands/status.js");
    await statusCommand(options.config);
  });

const cron = program.command("cron");
cron
  .command("list")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const { cronList } = await import("./commands/cron.js");
    await cronList(options.config);
  });
cron
  .command("add")
  .requiredOption("--id <id>", "Job id")
  .requiredOption("--schedule <cron>", "Cron expression")
  .requiredOption("--prompt <text>", "Prompt")
  .requiredOption("--session <key>", "Session key")
  .option("--config <path>", "Path to config file")
  .action(
    async (options: { id: string; schedule: string; prompt: string; session: string; config?: string }) => {
      const { cronAdd } = await import("./commands/cron.js");
      await cronAdd(options.id, options.schedule, options.prompt, options.session, options.config);
    },
  );
cron
  .command("remove")
  .requiredOption("--id <id>", "Job id")
  .option("--config <path>", "Path to config file")
  .action(async (options: { id: string; config?: string }) => {
    const { cronRemove } = await import("./commands/cron.js");
    await cronRemove(options.id, options.config);
  });
cron
  .command("update")
  .requiredOption("--id <id>", "Job id")
  .option("--schedule <cron>", "Cron expression")
  .option("--prompt <text>", "Prompt")
  .option("--session <key>", "Session key")
  .option("--config <path>", "Path to config file")
  .action(
    async (options: { id: string; schedule?: string; prompt?: string; session?: string; config?: string }) => {
      const { cronUpdate } = await import("./commands/cron.js");
      await cronUpdate(
        options.id,
        {
          schedule: options.schedule,
          prompt: options.prompt,
          sessionKey: options.session,
        },
        options.config,
      );
    },
  );
cron
  .command("enable")
  .requiredOption("--id <id>", "Job id")
  .option("--config <path>", "Path to config file")
  .action(async (options: { id: string; config?: string }) => {
    const { cronEnable } = await import("./commands/cron.js");
    await cronEnable(options.id, true, options.config);
  });
cron
  .command("disable")
  .requiredOption("--id <id>", "Job id")
  .option("--config <path>", "Path to config file")
  .action(async (options: { id: string; config?: string }) => {
    const { cronEnable } = await import("./commands/cron.js");
    await cronEnable(options.id, false, options.config);
  });

const channels = program.command("channels");
channels
  .command("login")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
  const { channelsLoginCommand } = await import("./commands/channels.js");
    await channelsLoginCommand(options.config);
});

const config = program.command("config");
config
  .command("show")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const { configShowCommand } = await import("./commands/config.js");
    await configShowCommand(options.config);
  });

program
  .command("doctor")
  .option("--config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const { doctorCommand } = await import("./commands/doctor.js");
    await doctorCommand(options.config);
  });

await program.parseAsync(process.argv);
