/**
 * MESH CACHE
 * ==========
 * Global singleton cache for loaded GLTF scenes.
 * Ensures each mesh URL is fetched and parsed exactly once,
 * then cloned for each instance in the office scene.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

export interface CachedMesh {
  scene: THREE.Object3D;
  boundingBox: THREE.Box3;
  /** Y offset to apply so the mesh bottom sits on y=0 */
  groundOffset: number;
}

type CacheEntry =
  | { status: "loading"; promise: Promise<CachedMesh> }
  | { status: "loaded"; mesh: CachedMesh }
  | { status: "error"; error: string };

const cache = new Map<string, CacheEntry>();
const loader = new GLTFLoader();

function computeGroundOffset(scene: THREE.Object3D): { box: THREE.Box3; offset: number } {
  const box = new THREE.Box3().setFromObject(scene);
  const offset = box.min.y < 0 ? -box.min.y : 0;
  return { box, offset };
}

function loadMesh(url: string): Promise<CachedMesh> {
  return new Promise<CachedMesh>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const { box, offset } = computeGroundOffset(gltf.scene);
        resolve({ scene: gltf.scene, boundingBox: box, groundOffset: offset });
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}

export function getMesh(url: string): CacheEntry | undefined {
  return cache.get(url);
}

export function cloneCachedScene(cached: CachedMesh): THREE.Object3D {
  return SkeletonUtils.clone(cached.scene);
}

export async function preloadMesh(url: string): Promise<CachedMesh> {
  const existing = cache.get(url);
  if (existing?.status === "loaded") return existing.mesh;
  if (existing?.status === "loading") return existing.promise;

  const promise = loadMesh(url).then(
    (mesh) => {
      cache.set(url, { status: "loaded", mesh });
      return mesh;
    },
    (err) => {
      const message = err instanceof Error ? err.message : "mesh_load_failed";
      cache.set(url, { status: "error", error: message });
      throw err;
    },
  );
  cache.set(url, { status: "loading", promise });
  return promise;
}

export async function preloadMeshes(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))];
  await Promise.allSettled(unique.map(preloadMesh));
}

export function clearMeshCache(): void {
  cache.clear();
}
