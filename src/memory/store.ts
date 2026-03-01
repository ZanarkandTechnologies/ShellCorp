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
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

import type { ObservationEvent, ObservationPromotionResult, ObservationSignalType, ObservationTrustClass } from "../types.js";
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
  minConfidenceAutoPromote?: number;
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

export interface ObservationQueryFilters {
  projectId?: string;
  groupId?: string;
  sessionKey?: string;
  source?: string;
  projectTag?: string;
  trustClass?: ObservationTrustClass;
  signalType?: ObservationSignalType;
  status?: "accepted" | "pending_review";
}

export interface MemoryStoreOptions {
  convex?: {
    deploymentUrl: string;
    authToken?: string;
  };
}

export class MemoryStore {
  private readonly client: ConvexHttpClient | null;

  constructor(private readonly workspaceDir: string, options: MemoryStoreOptions = {}) {
    if (options.convex?.deploymentUrl) {
      this.client = new ConvexHttpClient(options.convex.deploymentUrl);
      if (options.convex.authToken) this.client.setAuth(options.convex.authToken);
      return;
    }
    this.client = null;
  }

  private historyPath(): string {
    return path.join(this.workspaceDir, "HISTORY.md");
  }

  private memoryPath(): string {
    return path.join(this.workspaceDir, "MEMORY.md");
  }

  async ensureFiles(): Promise<void> {
    if (this.client) return;
    await mkdir(this.workspaceDir, { recursive: true });
    await writeFile(this.historyPath(), await this.safeRead(this.historyPath()), "utf8");
    await writeFile(this.memoryPath(), await this.safeRead(this.memoryPath()), "utf8");
  }

  async appendHistory(entry: string): Promise<void> {
    if (this.client) return;
    await this.ensureFiles();
    const line = `- [${new Date().toISOString()}] ${entry}\n`;
    await appendFile(this.historyPath(), line, "utf8");
  }

  async appendObservation(
    input: NormalizeObservationInput,
    policy: MemoryPromotionPolicy = { autoPromoteTrust: ["trusted", "system"] },
  ): Promise<{ event: ObservationEvent; promotion: ObservationPromotionResult }> {
    if (this.client) {
      const event = normalizeObservation(input);
      const response = await this.client.mutation(anyApi.memory.appendObservation, {
        event,
        autoPromoteTrust: policy.autoPromoteTrust,
        minConfidenceAutoPromote: policy.minConfidenceAutoPromote ?? 0.7,
      }) as { event: ObservationEvent; promotion: ObservationPromotionResult };
      return response;
    }
    await this.ensureFiles();
    const event = normalizeObservation(input);
    const minConfidenceAutoPromote = policy.minConfidenceAutoPromote ?? 0.7;
    const shouldPendForReview = event.confidence < minConfidenceAutoPromote;
    const finalEvent = shouldPendForReview ? { ...event, status: "pending_review" as const } : event;
    await appendFile(this.historyPath(), `${toHistoryLine(finalEvent)}\n`, "utf8");

    if (shouldPendForReview) {
      return { event: finalEvent, promotion: { promoted: false, reason: "low_confidence_pending_review" } };
    }

    if (!canAutoPromote(finalEvent, policy.autoPromoteTrust)) {
      return { event: finalEvent, promotion: { promoted: false, reason: `trust_requires_approval:${finalEvent.trustClass}` } };
    }

    const promotionClass = choosePromotionClass(finalEvent);
    await appendFile(this.memoryPath(), `- ${formatMemoryEntry(finalEvent, promotionClass)}\n`, "utf8");
    return {
      event: finalEvent,
      promotion: {
        promoted: true,
        reason: "auto_promoted",
        promotionClass,
      },
    };
  }

  async listObservations(limit = 200, filters: ObservationQueryFilters = {}): Promise<ObservationEvent[]> {
    if (this.client) {
      const rows = await this.client.query(anyApi.memory.listObservations, {
        limit,
        ...filters,
      }) as ObservationEvent[];
      return rows;
    }
    const history = await this.readHistory();
    const lines = history.split(/\r?\n/).filter(Boolean);
    const parsed = lines
      .map((line) => parseHistoryLine(line))
      .filter((event): event is ObservationEvent => Boolean(event));
    const safeLimit = Math.max(1, Math.min(limit, 5000));
    const filtered = parsed.filter((event) => {
      if (filters.projectId && event.projectId !== filters.projectId) return false;
      if (filters.groupId && event.groupId !== filters.groupId) return false;
      if (filters.sessionKey && event.sessionKey !== filters.sessionKey) return false;
      if (filters.source && event.source !== filters.source) return false;
      if (filters.projectTag && !event.projectTags.includes(filters.projectTag)) return false;
      if (filters.trustClass && event.trustClass !== filters.trustClass) return false;
      if (filters.signalType && !event.signals.some((signal) => signal.type === filters.signalType)) return false;
      if (filters.status && event.status !== filters.status) return false;
      return true;
    });
    return filtered.slice(Math.max(0, filtered.length - safeLimit));
  }

  async readHistory(filters: ObservationQueryFilters = {}): Promise<string> {
    if (this.client) {
      const lines = await this.client.query(anyApi.memory.listHistoryLines, {
        limit: 1000,
        ...filters,
      }) as string[];
      return lines.join("\n");
    }
    return this.safeRead(this.historyPath());
  }

  async readMemory(filters: ObservationQueryFilters = {}): Promise<string> {
    if (this.client) {
      const lines = await this.client.query(anyApi.memory.listMemoryLines, {
        limit: 1000,
        ...filters,
      }) as string[];
      return lines.join("\n");
    }
    return this.safeRead(this.memoryPath());
  }

  async appendMemory(entry: string): Promise<void> {
    if (this.client) return;
    await this.ensureFiles();
    await appendFile(this.memoryPath(), `- ${entry}\n`, "utf8");
  }

  async truncateHistory(keepLastLines = 200): Promise<void> {
    if (this.client) return;
    const history = await this.readHistory();
    const lines = history.split(/\r?\n/);
    const trimmed = lines.slice(Math.max(0, lines.length - keepLastLines)).join("\n");
    await writeFile(this.historyPath(), trimmed, "utf8");
  }

  async compressHistoryIfNeeded(options: MemoryCompressionOptions): Promise<CompressionResult> {
    if (this.client) {
      return { compressed: false, reason: "db_backend" };
    }
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
