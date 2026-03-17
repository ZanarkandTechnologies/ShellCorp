/**
 * USE DELETE OFFICE OBJECT
 * ========================
 * Shared delete logic for office objects (context menu and transform panel).
 *
 * USAGE:
 * - Use from InteractiveObject to power the Delete context menu action.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { OfficeId } from "@/lib/types";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { useAppStore } from "@/lib/app-store";
import { resolvePersistedOfficeObjectId } from "../components/office-object-id";
import { refreshOfficeDataSafely } from "../components/office-object-refresh";

function getObjectLabel(
  meshType: string,
  metadata?: Record<string, unknown>,
): string {
  if (typeof metadata?.displayName === "string" && metadata.displayName) {
    return metadata.displayName;
  }
  return meshType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function useDeleteOfficeObject(objectId: OfficeId<"officeObjects">): {
  deleteObject: () => Promise<void>;
  isDeleting: boolean;
} {
  const adapter = useOpenClawAdapter();
  const { officeObjects, refresh } = useOfficeDataContext();
  const setActiveObjectTransformId = useAppStore((state) => state.setActiveObjectTransformId);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteObject = useCallback(async (): Promise<void> => {
    const activeObject = officeObjects.find((o) => o._id === objectId) ?? null;
    if (!activeObject) return;
    const objectLabel = getObjectLabel(activeObject.meshType, activeObject.metadata);
    if (activeObject.meshType === "team-cluster") {
      toast.error(
        `Cannot delete ${objectLabel}. Archive or remove the team/project instead of deleting its scene anchor.`,
      );
      return;
    }
    setIsDeleting(true);
    try {
      const current = await adapter.getOfficeObjects();
      const knownIds = new Set(current.map((item) => item.id));
      const persistedId = resolvePersistedOfficeObjectId(activeObject._id, knownIds);
      const result = await adapter.deleteOfficeObject(persistedId, { currentObjects: current });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to delete object.");
        return;
      }
      await refreshOfficeDataSafely(refresh);
      setActiveObjectTransformId(null);
      toast.success(`Deleted ${objectLabel}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete object.");
    } finally {
      setIsDeleting(false);
    }
  }, [adapter, objectId, officeObjects, refresh, setActiveObjectTransformId]);

  return { deleteObject, isDeleting };
}
