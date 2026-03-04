#!/usr/bin/env node

/**
 * SHELLCORP CLI
 * =============
 * Purpose
 * - Provide CEO/operator command-line management for ShellCorp team entities.
 *
 * KEY CONCEPTS:
 * - Team state lives in OpenClaw sidecar files under ~/.openclaw by default.
 * - Teams map to projects in company.json.
 *
 * USAGE:
 * - npm run shell -- team list
 * - npm run shell -- team create --name "Alpha" --description "Core team" --goal "Ship"
 *
 * MEMORY REFERENCES:
 * - MEM-0104
 */
import { Command } from "commander";
import { registerOfficeCommands } from "./office-commands.js";
import { registerDoctorCommands } from "./team-commands.js";
import { registerTeamCommands } from "./team-commands.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("shellcorp")
    .description("ShellCorp team management CLI")
    .version("0.1.0");

  registerTeamCommands(program);
  registerDoctorCommands(program);
  registerOfficeCommands(program);

  await program.parseAsync(process.argv);
}

void main();

