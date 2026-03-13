/**
 * OFFICE LAYOUT EDITOR
 * ====================
 * Builder-mode paint/remove interaction for tile-based office floor editing.
 *
 * KEY CONCEPTS:
 * - Layout editing lives in the scene so pointer drags operate on real world coordinates.
 * - Strokes preview locally and persist once on release to keep writes bounded.
 *
 * USAGE:
 * - Render from `SceneContents` while builder mode is active.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Html, Plane } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import {
  applyOfficeLayoutPaint,
  expandOfficeLayoutRemovalStroke,
  fillEnclosedOfficeLayoutGaps,
  getOfficeFootprintFromLayout,
  getOfficeLayoutEditBounds,
  getPreferredManagementAnchorFromOfficeLayout,
  hasOfficeLayoutTile,
  isPositionInsideOfficeLayout,
  officeLayoutTileKey,
  parseOfficeLayoutTileKey,
} from "@/lib/office-layout";
import { saveOfficeSettingsOptimistically } from "./office-layout-save";

const OBJECT_MARGIN = 1;
const TEAM_MARGIN = 3;

function snapCell(value: number): number {
  return Math.round(value);
}

function getCellsBetween(
  start: { x: number; z: number },
  end: { x: number; z: number },
): Array<{ x: number; z: number }> {
  const cells: Array<{ x: number; z: number }> = [];
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  const steps = Math.max(Math.abs(deltaX), Math.abs(deltaZ));
  if (steps === 0) return [start];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    cells.push({
      x: Math.round(start.x + deltaX * t),
      z: Math.round(start.z + deltaZ * t),
    });
  }
  return cells;
}

export function OfficeLayoutEditor(): JSX.Element | null {
  const adapter = useOpenClawAdapter();
  const { officeSettings, officeObjects, teams, applyOfficeSettings } = useOfficeDataContext();
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const activeBuilderTool = useAppStore((state) => state.activeBuilderTool);
  const [strokeCells, setStrokeCells] = useState<Set<string>>(new Set());
  const [isPainting, setIsPainting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastStrokeCellRef = useRef<{ x: number; z: number } | null>(null);

  const editBounds = useMemo(
    () => getOfficeLayoutEditBounds(officeSettings.officeLayout, 8),
    [officeSettings.officeLayout],
  );
  let paintMode: "add" | "remove" | null = null;
  if (activeBuilderTool === "paint-floor") paintMode = "add";
  else if (activeBuilderTool === "remove-floor") paintMode = "remove";

  const effectiveStrokeCells = useMemo(() => {
    if (strokeCells.size === 0) return new Set<string>();
    if (paintMode === "add") {
      const nextLayout = fillEnclosedOfficeLayoutGaps(
        applyOfficeLayoutPaint(officeSettings.officeLayout, strokeCells, "add"),
      );
      return new Set(
        nextLayout.tiles.filter((tile) => {
          const parsed = parseOfficeLayoutTileKey(tile);
          return parsed ? !hasOfficeLayoutTile(officeSettings.officeLayout, parsed.x, parsed.z) : false;
        }),
      );
    }
    return expandOfficeLayoutRemovalStroke(officeSettings.officeLayout, strokeCells);
  }, [officeSettings.officeLayout, paintMode, strokeCells]);

  const previewCells = useMemo(() => {
    const cells: Array<{ key: string; x: number; z: number }> = [];
    for (const key of effectiveStrokeCells) {
      const [xRaw, zRaw] = key.split(":");
      cells.push({ key, x: Number(xRaw), z: Number(zRaw) });
    }
    return cells;
  }, [effectiveStrokeCells]);

  useEffect(() => {
    setStrokeCells(new Set());
    setIsPainting(false);
    setErrorMessage(null);
    lastStrokeCellRef.current = null;
  }, [paintMode]);

  if (!isBuilderMode || !paintMode) return null;

  const recordCell = (x: number, z: number): void => {
    const nextCell = { x, z };
    const source = lastStrokeCellRef.current ?? nextCell;
    const traversedCells = getCellsBetween(source, nextCell);
    lastStrokeCellRef.current = nextCell;
    setStrokeCells((current) => {
      const next = new Set(current);
      let changed = false;
      for (const cell of traversedCells) {
        const key = officeLayoutTileKey(cell.x, cell.z);
        const exists = hasOfficeLayoutTile(officeSettings.officeLayout, cell.x, cell.z);
        if (paintMode === "add" && exists) continue;
        if (paintMode === "remove" && !exists) continue;
        if (next.has(key)) continue;
        next.add(key);
        changed = true;
      }
      return changed ? next : current;
    });
  };

  const resolveStrokeCell = (event: ThreeEvent<PointerEvent>): { x: number; z: number } => ({
    x: snapCell(event.point.x),
    z: snapCell(event.point.z),
  });

  const commitStroke = async (): Promise<void> => {
    if (strokeCells.size === 0) {
      setIsPainting(false);
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    let nextLayout = officeSettings.officeLayout;
    let blockedCount = 0;
    if (paintMode === "add") {
      nextLayout = applyOfficeLayoutPaint(nextLayout, effectiveStrokeCells, "add");
      nextLayout = fillEnclosedOfficeLayoutGaps(nextLayout);
    } else {
      const preferredManagementAnchor = getPreferredManagementAnchorFromOfficeLayout(
        officeSettings.officeLayout,
      );
      const expandedStroke = effectiveStrokeCells;
      const sortedCells = [...expandedStroke].sort();
      for (const key of sortedCells) {
        const candidate = applyOfficeLayoutPaint(nextLayout, [key], "remove");
        const isValidForObjects = officeObjects.every((object) =>
          isPositionInsideOfficeLayout(
            object.position,
            candidate,
            object.meshType === "team-cluster" ? 2 : OBJECT_MARGIN,
          ),
        );
        const isValidForTeams = teams.every(
          (team) =>
            !Array.isArray(team.clusterPosition) ||
            isPositionInsideOfficeLayout(team.clusterPosition, candidate, TEAM_MARGIN),
        );
        const keepsManagementArea = isPositionInsideOfficeLayout(
          preferredManagementAnchor,
          candidate,
          0,
        );
        if (isValidForObjects && isValidForTeams && keepsManagementArea) {
          nextLayout = candidate;
        } else {
          blockedCount += 1;
        }
      }
    }

    setStrokeCells(new Set());
    setIsPainting(false);
    lastStrokeCellRef.current = null;

    if (nextLayout.tiles.join("|") === officeSettings.officeLayout.tiles.join("|")) {
      setIsSaving(false);
      if (blockedCount > 0) {
        setErrorMessage(`Skipped ${blockedCount} tile${blockedCount === 1 ? "" : "s"} because content still depends on them.`);
      }
      return;
    }

    const nextSettings = {
      ...officeSettings,
      officeLayout: nextLayout,
      officeFootprint: getOfficeFootprintFromLayout(nextLayout),
    };

    try {
      const result = await saveOfficeSettingsOptimistically({
        previousSettings: officeSettings,
        nextSettings,
        applyOfficeSettings,
        saveOfficeSettings: (settings) => adapter.saveOfficeSettings(settings),
      });
      if (!result.ok) {
        setErrorMessage(result.error ?? "Failed to save office layout.");
        return;
      }
      if (blockedCount > 0) {
        setErrorMessage(`Saved layout. Skipped ${blockedCount} protected tile${blockedCount === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save office layout.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <group>
      <Plane
        args={[editBounds.width, editBounds.depth]}
        position={[editBounds.centerX, 0.03, editBounds.centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          event.stopPropagation();
          const cell = resolveStrokeCell(event);
          setStrokeCells(new Set());
          setIsPainting(true);
          lastStrokeCellRef.current = cell;
          recordCell(cell.x, cell.z);
        }}
        onPointerMove={(event) => {
          if (!isPainting) return;
          event.stopPropagation();
          const cell = resolveStrokeCell(event);
          recordCell(cell.x, cell.z);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          setIsPainting(false);
        }}
      >
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </Plane>

      {previewCells.map((cell) => (
        <mesh
          key={cell.key}
          position={[cell.x, 0.06, cell.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={paintMode === "add" ? "#4ade80" : "#ef4444"}
            transparent
            opacity={0.38}
          />
        </mesh>
      ))}

      <Html position={[editBounds.centerX, 3.6, editBounds.centerZ]} center>
        <div className="pointer-events-auto min-w-80 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 text-xs text-foreground shadow-lg backdrop-blur">
          <p className="font-medium">
            {paintMode === "add" ? "Drag to add floor tiles" : "Drag to shovel out floor tiles"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Painted tiles stay in preview until you click <strong>Apply</strong>. Exiting builder mode does not auto-save the current stroke.
          </p>
          {errorMessage ? <p className="mt-2 text-destructive">{errorMessage}</p> : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {previewCells.length} tile{previewCells.length === 1 ? "" : "s"} selected
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStrokeCells(new Set());
                  setErrorMessage(null);
                  setIsPainting(false);
                  lastStrokeCellRef.current = null;
                }}
                disabled={isSaving || previewCells.length === 0}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void commitStroke()}
                disabled={isSaving || previewCells.length === 0}
              >
                {isSaving ? "Saving..." : "Apply"}
              </Button>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
