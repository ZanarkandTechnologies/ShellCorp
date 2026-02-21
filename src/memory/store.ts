import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";

export class MemoryStore {
  constructor(private readonly workspaceDir: string) {}

  private historyPath(): string {
    return path.join(this.workspaceDir, "HISTORY.md");
  }

  private memoryPath(): string {
    return path.join(this.workspaceDir, "MEMORY.md");
  }

  async ensureFiles(): Promise<void> {
    await mkdir(this.workspaceDir, { recursive: true });
    await writeFile(this.historyPath(), await this.safeRead(this.historyPath()), "utf8");
    await writeFile(this.memoryPath(), await this.safeRead(this.memoryPath()), "utf8");
  }

  async appendHistory(entry: string): Promise<void> {
    await this.ensureFiles();
    const line = `- [${new Date().toISOString()}] ${entry}\n`;
    await appendFile(this.historyPath(), line, "utf8");
  }

  async readHistory(): Promise<string> {
    return this.safeRead(this.historyPath());
  }

  async readMemory(): Promise<string> {
    return this.safeRead(this.memoryPath());
  }

  async appendMemory(entry: string): Promise<void> {
    await this.ensureFiles();
    await appendFile(this.memoryPath(), `- ${entry}\n`, "utf8");
  }

  async truncateHistory(keepLastLines = 200): Promise<void> {
    const history = await this.readHistory();
    const lines = history.split("\n");
    const trimmed = lines.slice(Math.max(0, lines.length - keepLastLines)).join("\n");
    await writeFile(this.historyPath(), trimmed, "utf8");
  }

  private async safeRead(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      return "";
    }
  }
}
