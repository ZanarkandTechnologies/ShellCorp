import { MemoryStore } from "./store.js";
import type { ObservationQueryFilters } from "./store.js";

export async function searchMemory(memoryStore: MemoryStore, query: string, filters: ObservationQueryFilters = {}): Promise<string[]> {
  const content = `${await memoryStore.readMemory(filters)}\n${await memoryStore.readHistory(filters)}`;
  const lines = content.split("\n");
  const needle = query.toLowerCase();
  return lines.filter((line) => line.toLowerCase().includes(needle)).slice(0, 50);
}
