/**
 * STARTER OFFICE TEMPLATES
 * ========================
 * Purpose
 * - Load the canonical starter-office seed shared by onboarding and explicit office init flows.
 *
 * KEY CONCEPTS:
 * - The starter office is file-backed under `templates/sidecar`.
 * - `office.json` and `office-objects.json` must stay aligned so new installs inherit both the
 *   reduced layout footprint and the matching starter furniture.
 *
 * USAGE:
 * - `const starter = await readStarterOfficeTemplates();`
 *
 * MEMORY REFERENCES:
 * - MEM-0224
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OfficeObjectModel, OfficeSettingsModel } from "./sidecar-store.js";

function resolveRepoRoot(): string {
  const override = process.env.SHELLCORP_REPO_ROOT?.trim();
  if (override) return path.resolve(override);
  const candidateRoot = path.resolve(__dirname, "..");
  const templatesMarker = path.join(candidateRoot, "templates", "sidecar", "company.template.json");
  if (existsSync(templatesMarker)) return candidateRoot;
  return path.resolve(process.cwd());
}

async function readJsonTemplate<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export interface StarterOfficeTemplates {
  officeSettings: OfficeSettingsModel;
  officeObjects: OfficeObjectModel[];
}

export async function readStarterOfficeTemplates(): Promise<StarterOfficeTemplates> {
  const repoRoot = resolveRepoRoot();
  const templatesRoot = path.join(repoRoot, "templates", "sidecar");
  const officeSettings = await readJsonTemplate<OfficeSettingsModel>(
    path.join(templatesRoot, "office.template.json"),
  );
  const officeObjects = await readJsonTemplate<OfficeObjectModel[]>(
    path.join(templatesRoot, "office-objects.template.json"),
  );
  return {
    officeSettings,
    officeObjects,
  };
}
