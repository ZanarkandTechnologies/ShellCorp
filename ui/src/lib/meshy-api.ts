/**
 * MESHY TEXT-TO-3D API CLIENT
 * ===========================
 * Client for Meshy.ai text-to-3D API. Generate 3D models from text; export as GLB.
 *
 * Set VITE_MESHY_API_KEY in .env to enable. API key format: msy-...
 * Docs: https://docs.meshy.ai/en/api/text-to-3d
 */

const MESHY_BASE = "https://api.meshy.ai/openapi/v2";
const API_KEY = typeof import.meta !== "undefined" ? import.meta.env?.VITE_MESHY_API_KEY : "";

export function getMeshyApiKey(): string {
  return typeof API_KEY === "string" ? API_KEY.trim() : "";
}

export function isMeshyConfigured(): boolean {
  return getMeshyApiKey().length > 0;
}

export interface MeshyTextTo3dTask {
  id: string;
  type: string;
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
  progress?: number;
  model_urls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
  };
  task_error?: { message?: string };
  prompt?: string;
}

export interface CreatePreviewOptions {
  prompt: string;
  model_type?: "lowpoly" | "standard";
  ai_model?: "latest" | "meshy-6" | "meshy-5";
  target_polycount?: number;
  moderation?: boolean;
}

export interface CreateRefineOptions {
  preview_task_id: string;
  texture_prompt?: string;
  enable_pbr?: boolean;
}

async function meshyFetch<T>(
  path: string,
  options: RequestInit & { body?: object } = {},
): Promise<T> {
  const key = getMeshyApiKey();
  if (!key) {
    throw new Error("Meshy API key not set. Add VITE_MESHY_API_KEY to your .env file.");
  }
  const { body, ...rest } = options;
  const res = await fetch(`${MESHY_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    let errMessage = `Meshy API error ${res.status}`;
    try {
      const json = JSON.parse(text) as { message?: string; error?: string };
      errMessage = json.message ?? json.error ?? errMessage;
    } catch {
      if (text) errMessage = text.slice(0, 200);
    }
    throw new Error(errMessage);
  }
  return res.json() as Promise<T>;
}

/** Create a text-to-3D preview task. Returns task id. */
export async function createTextTo3dPreview(
  options: CreatePreviewOptions,
): Promise<{ result: string }> {
  const { prompt, model_type, ai_model, target_polycount, moderation } = options;
  return meshyFetch<{ result: string }>("/text-to-3d", {
    method: "POST",
    body: {
      mode: "preview",
      prompt: prompt.slice(0, 600),
      ...(model_type != null ? { model_type } : {}),
      ...(ai_model != null ? { ai_model } : {}),
      ...(target_polycount != null ? { target_polycount } : {}),
      ...(moderation != null ? { moderation } : {}),
    },
  });
}

/** Create a refine task (textured model) from a succeeded preview. Returns task id. */
export async function createTextTo3dRefine(
  options: CreateRefineOptions,
): Promise<{ result: string }> {
  return meshyFetch<{ result: string }>("/text-to-3d", {
    method: "POST",
    body: {
      mode: "refine",
      preview_task_id: options.preview_task_id,
      ...(options.texture_prompt != null ? { texture_prompt: options.texture_prompt.slice(0, 600) } : {}),
      ...(options.enable_pbr != null ? { enable_pbr: options.enable_pbr } : {}),
    },
  });
}

/** Get task status and result. When status is SUCCEEDED, model_urls.glb is available. */
export async function getTextTo3dTask(taskId: string): Promise<MeshyTextTo3dTask> {
  return meshyFetch<MeshyTextTo3dTask>(`/text-to-3d/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
}

/** Poll until task succeeds or fails. Returns final task. */
export async function pollTextTo3dTask(
  taskId: string,
  options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<MeshyTextTo3dTask> {
  const { intervalMs = 3000, maxAttempts = 120 } = options;
  for (let i = 0; i < maxAttempts; i++) {
    const task = await getTextTo3dTask(taskId);
    if (task.status === "SUCCEEDED" || task.status === "FAILED") {
      return task;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Meshy task timed out.");
}
