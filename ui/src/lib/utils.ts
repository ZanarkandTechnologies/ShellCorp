import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getRandomItem<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("getRandomItem requires a non-empty array");
  }
  return items[Math.floor(Math.random() * items.length)] as T;
}
