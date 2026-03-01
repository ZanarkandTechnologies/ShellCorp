import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function resolveSecretValue(value: string): Promise<string> {
  if (value.startsWith("$")) {
    const envName = value.slice(1);
    const envValue = process.env[envName];
    if (!envValue) {
      throw new Error(`Missing environment variable: ${envName}`);
    }
    return envValue;
  }

  if (value.startsWith("!")) {
    const command = value.slice(1).trim();
    const { stdout } = await execAsync(command, { timeout: 10_000 });
    return stdout.trim();
  }

  return value;
}
