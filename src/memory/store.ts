/**
 * MEMORY STORE
 * ============
 * File-backed history/memory storage with structured observational support.
 *
 * KEY CONCEPTS:
 * - HISTORY.md stores append-only observation events with provenance.
 * - MEMORY.md stores promoted durable entries after trust/policy checks.
 * - Compression preserves replayability by snapshotting before truncation.
 *
 * USAGE:
 * - appendObservation for structured workflow deltas.
 * - appendHistory for free-text legacy entries.
 * - compressHistoryIfNeeded from heartbeat/scheduled maintenance.
 *
 * MEMORY REFERENCES:
 * - MEM-0006
 * - MEM-0010
 */
import { mkdir, readFile, writeFile, appendFile, stat } from "node:fs/promises";
import path from "node:path";

import type { ObservationEvent, ObservationPromotionResult, ObservationTrustClass } from "../types.js";
import {
  canAutoPromote,
  choosePromotionClass,
  formatMemoryEntry,
  normalizeObservation,
  parseHistoryLine,
  toHistoryLine,
  type NormalizeObservationInput,
} from "./observations.js";

export interface MemoryPromotionPolicy {
  autoPromoteTrust: ObservationTrustClass[];
}

export interface MemoryCompressionOptions {
  maxLines: number;
  maxBytes: number;
  minAgeMinutes: number;
  keepLastLines: number;
  snapshotDir: string;
}

export interface CompressionResult {
  compressed: boolean;
  reason?: string;
  snapshotPath?: string;
}

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

  async appendObservation(
    input: NormalizeObservationInput,
    policy: MemoryPromotionPolicy = { autoPromoteTrust: ["trusted", "system"] },
  ): Promise<{ event: ObservationEvent; promotion: ObservationPromotionResult }> {
    await this.ensureFiles();
    const event = normalizeObservation(input);
    await appendFile(this.historyPath(), `${toHistoryLine(event)}\n`, "utf8");

    if (!canAutoPromote(event, policy.autoPromoteTrust)) {
      return { event, promotion: { promoted: false, reason: `trust_requires_approval:${event.trustClass}` } };
    }

    const promotionClass = choosePromotionClass(event);
    await appendFile(this.memoryPath(), `- ${formatMemoryEntry(event, promotionClass)}\n`, "utf8");
    return {
      event,
      promotion: {
        promoted: true,
        reason: "auto_promoted",
        promotionClass,
      },
    };
  }

  async listObservations(limit = 200): Promise<ObservationEvent[]> {
    const history = await this.readHistory();
    const lines = history.split(/\r?\n/).filter(Boolean);
    const parsed = lines
      .map((line) => parseHistoryLine(line))
      .filter((event): event is ObservationEvent => Boolean(event));
    const safeLimit = Math.max(1, Math.min(limit, 5000));
    return parsed.slice(Math.max(0, parsed.length - safeLimit));
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
    const lines = history.split(/\r?\n/);
    const trimmed = lines.slice(Math.max(0, lines.length - keepLastLines)).join("\n");
    await writeFile(this.historyPath(), trimmed, "utf8");
  }

  async compressHistoryIfNeeded(options: MemoryCompressionOptions): Promise<CompressionResult> {
    await this.ensureFiles();
    const historyPath = this.historyPath();
    const history = await this.readHistory();
    const lines = history.split(/\r?\n/).filter(Boolean);
    const historyStat = await stat(historyPath);
    const overThreshold = lines.length > options.maxLines || historyStat.size > options.maxBytes;
    if (!overThreshold) {
      return { compressed: false, reason: "below_threshold" };
    }

    const minAgeMs = options.minAgeMinutes * 60 * 1000;
    const ageMs = Date.now() - historyStat.mtimeMs;
    if (ageMs < minAgeMs) {
      return { compressed: false, reason: "below_min_age" };
    }

    await mkdir(options.snapshotDir, { recursive: true });
    const snapshotPath = path.join(options.snapshotDir, `history-${Date.now()}.md`);
    await writeFile(snapshotPath, history, "utf8");
    await this.truncateHistory(options.keepLastLines);
    return {
      compressed: true,
      snapshotPath,
    };
  }

  private async safeRead(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      return "";
    }
  }
}
