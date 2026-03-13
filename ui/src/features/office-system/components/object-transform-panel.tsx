/**
 * OBJECT TRANSFORM PANEL
 * ======================
 * Precise builder-only transform editor for office objects.
 *
 * KEY CONCEPTS:
 * - Keep quick actions in the radial menu and reserve exact transform edits for a dedicated panel.
 * - Persist all transform changes through the existing office-object sidecar path.
 *
 * USAGE:
 * - Render once from the office simulation HUD.
 * - Open through `InteractiveObject` builder actions.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 * - MEM-0167
 */

"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/app-store";
import type { CompanyOfficeObjectModel } from "@/lib/openclaw-types";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { resolvePersistedOfficeObjectId } from "./office-object-id";
import { constrainOfficeObjectPositionForLayout } from "./office-object-placement";
import { refreshOfficeDataSafely } from "./office-object-refresh";

type TransformDraft = {
  x: string;
  y: string;
  z: string;
  rotationY: string;
  scale: string;
};

function toFixedDraft(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function getDefaultDraft(input: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}): TransformDraft {
  return {
    x: toFixedDraft(input.position[0]),
    y: toFixedDraft(input.position[1]),
    z: toFixedDraft(input.position[2]),
    rotationY: toFixedDraft(input.rotation?.[1] ?? 0),
    scale: toFixedDraft(input.scale?.[0] ?? 1),
  };
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ObjectTransformPanel(): JSX.Element | null {
  const adapter = useOpenClawAdapter();
  const { officeObjects, officeSettings, refresh } = useOfficeDataContext();
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const activeObjectTransformId = useAppStore((state) => state.activeObjectTransformId);
  const setActiveObjectTransformId = useAppStore((state) => state.setActiveObjectTransformId);

  const activeObject = useMemo(
    () => officeObjects.find((object) => object._id === activeObjectTransformId) ?? null,
    [activeObjectTransformId, officeObjects],
  );

  const [draft, setDraft] = useState<TransformDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isBuilderMode) {
      setActiveObjectTransformId(null);
      return;
    }
    if (!activeObject) {
      setDraft(null);
      setErrorMessage(null);
      return;
    }
    setDraft(
      getDefaultDraft({
        position: activeObject.position,
        rotation: activeObject.rotation,
        scale: activeObject.scale,
      }),
    );
    setErrorMessage(null);
  }, [activeObject, isBuilderMode, setActiveObjectTransformId]);

  if (!isBuilderMode || !activeObject || !draft) return null;

  const objectLabel =
    (typeof activeObject.metadata?.displayName === "string" && activeObject.metadata.displayName) ||
    activeObject.meshType
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const setField = (field: keyof TransformDraft, value: string): void => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const nudge = (field: keyof TransformDraft, delta: number): void => {
    setDraft((current) => {
      if (!current) return current;
      const fallback = field === "scale" ? 1 : 0;
      const next = parseNumber(current[field], fallback) + delta;
      const rounded = field === "rotationY" ? next : Number(next.toFixed(2));
      return {
        ...current,
        [field]: toFixedDraft(rounded),
      };
    });
  };

  const resetToCurrent = (): void => {
    setDraft(
      getDefaultDraft({
        position: activeObject.position,
        rotation: activeObject.rotation,
        scale: activeObject.scale,
      }),
    );
    setErrorMessage(null);
  };

  const snapToFloor = (): void => {
    setField("y", "0.00");
  };

  const save = async (): Promise<void> => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const current = await adapter.getOfficeObjects();
      const knownIds = new Set(current.map((item) => item.id));
      const persistedId = resolvePersistedOfficeObjectId(activeObject._id, knownIds);
      const existing = current.find((item) => item.id === persistedId);
      const nextPosition = constrainOfficeObjectPositionForLayout(
        [
          parseNumber(draft.x, activeObject.position[0]),
          parseNumber(draft.y, activeObject.position[1]),
          parseNumber(draft.z, activeObject.position[2]),
        ],
        officeSettings.officeLayout,
        activeObject.meshType,
      );
      const nextRotation: [number, number, number] = [
        activeObject.rotation?.[0] ?? 0,
        parseNumber(draft.rotationY, activeObject.rotation?.[1] ?? 0),
        activeObject.rotation?.[2] ?? 0,
      ];
      const nextScalar = Math.min(
        3,
        Math.max(0.4, parseNumber(draft.scale, activeObject.scale?.[0] ?? 1)),
      );
      const result = await adapter.upsertOfficeObject(
        {
          id: persistedId,
          identifier: existing?.identifier ?? persistedId,
          meshType: (existing?.meshType ??
            activeObject.meshType) as CompanyOfficeObjectModel["meshType"],
          position: nextPosition,
          rotation: nextRotation,
          scale: [nextScalar, nextScalar, nextScalar],
          metadata: existing?.metadata ?? activeObject.metadata ?? {},
        },
        { currentObjects: current },
      );
      if (!result.ok) {
        setErrorMessage(result.error ?? "Failed to save transform.");
        return;
      }
      await refreshOfficeDataSafely(refresh);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save transform.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pointer-events-auto">
      <Card className="w-80 border-border/80 bg-background/95 shadow-xl backdrop-blur">
        <CardHeader className="gap-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Transform {objectLabel}</CardTitle>
              <CardDescription>
                Exact builder controls for position, height, rotation, and scale.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setActiveObjectTransformId(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(["x", "y", "z"] as const).map((axis) => (
              <div key={axis} className="space-y-2">
                <Label
                  htmlFor={`transform-${axis}`}
                  className="uppercase text-[11px] tracking-[0.18em] text-muted-foreground"
                >
                  {axis}
                </Label>
                <Input
                  id={`transform-${axis}`}
                  inputMode="decimal"
                  value={draft[axis]}
                  onChange={(event) => setField(axis, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label
                htmlFor="transform-rotation"
                className="uppercase text-[11px] tracking-[0.18em] text-muted-foreground"
              >
                Rotation Y
              </Label>
              <Input
                id="transform-rotation"
                inputMode="decimal"
                value={draft.rotationY}
                onChange={(event) => setField("rotationY", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="transform-scale"
                className="uppercase text-[11px] tracking-[0.18em] text-muted-foreground"
              >
                Scale
              </Label>
              <Input
                id="transform-scale"
                inputMode="decimal"
                value={draft.scale}
                onChange={(event) => setField("scale", event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => nudge("y", 0.25)}>
              Raise +0.25
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => nudge("y", -0.25)}>
              Lower -0.25
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={snapToFloor}>
              Snap Y = 0
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetToCurrent}>
              Reset Draft
            </Button>
          </div>
          {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            X/Z snap to valid tile centers and stay clamped to the room margin. Use this panel for
            precise height fixes.
          </p>
          <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Apply"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
