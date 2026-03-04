/**
 * OFFICE RENDERER
 * ===============
 * Purpose
 * - Render a terminal-friendly, top-down 2D snapshot of office objects.
 *
 * KEY CONCEPTS:
 * - 3D office coordinates `[x,y,z]` are projected to an ASCII grid on x/z.
 * - Objects use stable glyphs so operators can read layout quickly in CLI.
 *
 * USAGE:
 * - renderOfficeAscii(objects, agents)
 *
 * MEMORY REFERENCES:
 * - MEM-0120
 */
import type { CompanyAgentModel, OfficeObjectModel } from "./sidecar-store.js";

const FLOOR_SIZE = 35;
const HALF_FLOOR = FLOOR_SIZE / 2;
const DEFAULT_WIDTH = 71;
const DEFAULT_HEIGHT = 36;

const RESET = "\u001b[0m";
const COLOR_MAP: Record<string, string> = {
  "team-cluster": "\u001b[34m",
  plant: "\u001b[32m",
  couch: "\u001b[35m",
  bookshelf: "\u001b[33m",
  pantry: "\u001b[36m",
  "glass-wall": "\u001b[90m",
  "custom-mesh": "\u001b[95m",
  agent: "\u001b[37m",
};

const PRIORITY_MAP: Record<string, number> = {
  "team-cluster": 90,
  "custom-mesh": 80,
  "glass-wall": 70,
  couch: 60,
  bookshelf: 60,
  pantry: 60,
  plant: 50,
};

const SYMBOL_MAP: Record<string, string> = {
  "team-cluster": "T",
  plant: "P",
  couch: "C",
  bookshelf: "B",
  pantry: "K",
  "glass-wall": "W",
  "custom-mesh": "M",
  agent: "A",
};

export interface RenderOfficeOptions {
  width?: number;
  height?: number;
  showCoords?: boolean;
  showLegend?: boolean;
  useColor?: boolean;
}

interface CellState {
  symbol: string;
  meshType: string;
  objectId: string;
  priority: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toCellX(x: number, width: number): number {
  const normalized = (x + HALF_FLOOR) / FLOOR_SIZE;
  return clamp(Math.round(normalized * (width - 1)), 0, width - 1);
}

function toCellRow(z: number, height: number): number {
  const normalized = (HALF_FLOOR - z) / FLOOR_SIZE;
  return clamp(Math.round(normalized * (height - 1)), 0, height - 1);
}

function glyphFor(meshType: string): string {
  return SYMBOL_MAP[meshType] ?? "O";
}

function priorityFor(meshType: string): number {
  return PRIORITY_MAP[meshType] ?? 10;
}

function colorize(symbol: string, meshType: string, enabled: boolean): string {
  if (!enabled) return symbol;
  const color = COLOR_MAP[meshType];
  return color ? `${color}${symbol}${RESET}` : symbol;
}

function formatLegendEntry(entry: CellState, useColor: boolean): string {
  const symbol = colorize(entry.symbol, entry.meshType, useColor);
  return `${symbol} ${entry.objectId} (${entry.meshType})`;
}

export function renderOfficeAscii(
  objects: OfficeObjectModel[],
  agents: CompanyAgentModel[],
  opts: RenderOfficeOptions = {},
): string {
  const width = Math.max(15, Math.floor(opts.width ?? DEFAULT_WIDTH));
  const height = Math.max(10, Math.floor(opts.height ?? DEFAULT_HEIGHT));
  const showCoords = opts.showCoords !== false;
  const showLegend = opts.showLegend !== false;
  const useColor = opts.useColor !== false;

  const grid: string[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => "."));
  const occupancy = new Map<string, CellState>();

  for (const object of objects) {
    const col = toCellX(object.position[0], width);
    const row = toCellRow(object.position[2], height);
    const key = `${row}:${col}`;
    const meshType = object.meshType;
    const candidate: CellState = {
      symbol: glyphFor(meshType),
      meshType,
      objectId: object.id,
      priority: priorityFor(meshType),
    };
    const current = occupancy.get(key);
    if (!current || candidate.priority >= current.priority) {
      occupancy.set(key, candidate);
    }
  }

  // We do not currently have x/z coordinates for company agents in sidecar data,
  // so the agent layer is represented in the legend count only.
  for (const [key, value] of occupancy.entries()) {
    const [rowText, colText] = key.split(":");
    const row = Number(rowText);
    const col = Number(colText);
    if (!Number.isFinite(row) || !Number.isFinite(col)) continue;
    grid[row][col] = colorize(value.symbol, value.meshType, useColor);
  }

  const lines: string[] = [];
  if (showCoords) {
    lines.push(`z +${HALF_FLOOR.toFixed(1)} (front)`);
  }
  for (const row of grid) {
    lines.push(row.join(""));
  }
  if (showCoords) {
    lines.push(`z -${HALF_FLOOR.toFixed(1)} (back)`);
    lines.push(`x -${HALF_FLOOR.toFixed(1)}${" ".repeat(Math.max(1, width - 18))}+${HALF_FLOOR.toFixed(1)}`);
  }

  if (showLegend) {
    lines.push("");
    lines.push("Legend:");
    const legendEntries = [...occupancy.values()].sort((a, b) => b.priority - a.priority);
    for (const entry of legendEntries) {
      lines.push(`- ${formatLegendEntry(entry, useColor)}`);
    }
    if (legendEntries.length === 0) {
      lines.push("- (no office objects)");
    }
    lines.push(`- A agents (${agents.length})`);
  }

  return lines.join("\n");
}

