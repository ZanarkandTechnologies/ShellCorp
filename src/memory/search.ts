import { MemoryStore } from "./store.js";

export async function searchMemory(memoryStore: MemoryStore, query: string): Promise<string[]> {
  const content = `${await memoryStore.readMemory()}\n${await memoryStore.readHistory()}`;
  const lines = content.split("\n");
  const needle = query.toLowerCase();
  return lines.filter((line) => line.toLowerCase().includes(needle)).slice(0, 50);
}
