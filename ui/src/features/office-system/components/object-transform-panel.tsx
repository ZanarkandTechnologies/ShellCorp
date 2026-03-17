/**
 * OBJECT TRANSFORM PANEL
 * ======================
 * Precise builder-only transform editor for office objects.
 *
 * KEY CONCEPTS:
 * - The panel owns the builder-side quick actions so the scene menu can stay minimal.
 * - Persist all transform changes through the existing office-object sidecar path.
 * - Panel position is local and draggable so builder HUD overlays do not block it.
 *
 * USAGE:
 * - Render once from the office simulation HUD.
 * - Open through `InteractiveObject` builder actions.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 * - MEM-0167
 * - MEM-0188
 * - MEM-0189
 */

"use client";

import { RotateCcw, RotateCw, Settings, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  canObjectScale,
  getNextRotationY,
  getNextUniformScale,
} from "./object-transform-panel.helpers";
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

type PanelPosition = {
  x: number;
  y: number;
};

const DEFAULT_PANEL_POSITION: PanelPosition = { x: 16, y: 16 };

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

function clampPanelPosition(position: PanelPosition): PanelPosition {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(16, window.innerWidth - 360);
  const maxY = Math.max(16, window.innerHeight - 520);
  return {
    x: Math.min(Math.max(16, position.x), maxX),
    y: Math.min(Math.max(16, position.y), maxY),
  };
}

export function ObjectTransformPanel(): ReactElement | null {
  const adapter = useOpenClawAdapter();
  const { officeObjects, officeSettings, refresh } = useOfficeDataContext();
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const activeObjectTransformId = useAppStore((state) => state.activeObjectTransformId);
  const setActiveObjectTransformId = useAppStore((state) => state.setActiveObjectTransformId);
  const setActiveObjectConfigId = useAppStore((state) => state.setActiveObjectConfigId);

  const activeObject = useMemo(
    () => officeObjects.find((object) => object._id === activeObjectTransformId) ?? null,
    [activeObjectTransformId, officeObjects],
  );

  const [draft, setDraft] = useState<TransformDraft | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>(DEFAULT_PANEL_POSITION);
  const dragOffsetRef = useRef<PanelPosition | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = (): void => {
      setPanelPosition((current) => clampPanelPosition(current));
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  if (!isBuilderMode || !activeObject || !draft) return null;

  const objectLabel =
    (typeof activeObject.metadata?.displayName === "string" && activeObject.metadata.displayName) ||
    activeObject.meshType
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  const scaleEnabled = canObjectScale(activeObject.meshType);

  const setField = (field: keyof TransformDraft, value: string): void => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const setDraftFromObject = (
    object: Pick<CompanyOfficeObjectModel, "position" | "rotation" | "scale">,
  ): void => {
    setDraft(
      getDefaultDraft({
        position: object.position,
        rotation: object.rotation,
        scale: object.scale,
      }),
    );
  };

  const persistObject = async (next: {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    metadata?: Record<string, unknown>;
  }): Promise<boolean> => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const current = await adapter.getOfficeObjects();
      const knownIds = new Set(current.map((item) => item.id));
      const persistedId = resolvePersistedOfficeObjectId(activeObject._id, knownIds);
      const existing = current.find((item) => item.id === persistedId);
      const result = await adapter.upsertOfficeObject(
        {
          id: persistedId,
          identifier: existing?.identifier ?? persistedId,
          meshType: (existing?.meshType ??
            activeObject.meshType) as CompanyOfficeObjectModel["meshType"],
          position: next.position ?? activeObject.position,
          rotation: next.rotation ?? activeObject.rotation ?? [0, 0, 0],
          scale: next.scale ?? activeObject.scale ?? [1, 1, 1],
          metadata: next.metadata ?? existing?.metadata ?? activeObject.metadata ?? {},
        },
        { currentObjects: current },
      );
      if (!result.ok) {
        setErrorMessage(result.error ?? "Failed to save transform.");
        return false;
      }
      await refreshOfficeDataSafely(refresh);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save transform.");
      return false;
    } finally {
      setIsSaving(false);
    }
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
    setDraftFromObject(activeObject);
    setErrorMessage(null);
  };

  const save = async (): Promise<void> => {
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
    const nextScale: [number, number, number] = [nextScalar, nextScalar, nextScalar];
    const ok = await persistObject({
      position: nextPosition,
      rotation: nextRotation,
      scale: nextScale,
    });
    if (ok) {
      setDraft({
        x: toFixedDraft(nextPosition[0]),
        y: toFixedDraft(nextPosition[1]),
        z: toFixedDraft(nextPosition[2]),
        rotationY: toFixedDraft(nextRotation[1]),
        scale: toFixedDraft(nextScalar),
      });
    }
  };

  const applyRotation = async (direction: "left" | "right"): Promise<void> => {
    if (isSaving) return;
    const nextRotationY = getNextRotationY(
      parseNumber(draft.rotationY, activeObject.rotation?.[1] ?? 0),
      direction,
    );
    const nextRotation: [number, number, number] = [
      activeObject.rotation?.[0] ?? 0,
      nextRotationY,
      activeObject.rotation?.[2] ?? 0,
    ];
    const ok = await persistObject({ rotation: nextRotation });
    if (ok) {
      setField("rotationY", toFixedDraft(nextRotationY));
    }
  };

  const applyScale = async (delta: number): Promise<void> => {
    if (!scaleEnabled || isSaving) return;
    const currentScalar = parseNumber(draft.scale, activeObject.scale?.[0] ?? 1);
    const nextScalar = getNextUniformScale(currentScalar, delta);
    const nextScale: [number, number, number] = [nextScalar, nextScalar, nextScalar];
    const ok = await persistObject({ scale: nextScale });
    if (ok) {
      setField("scale", toFixedDraft(nextScalar));
    }
  };

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    dragOffsetRef.current = {
      x: event.clientX - panelPosition.x,
      y: event.clientY - panelPosition.y,
    };
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
  };

  const handleHeaderPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragOffsetRef.current) return;
    setPanelPosition(
      clampPanelPosition({
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      }),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    dragOffsetRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className="pointer-events-auto fixed"
      style={{ left: panelPosition.x, top: panelPosition.y }}
    >
      <Card className="w-80 border-border/80 bg-background/95 shadow-xl backdrop-blur">
        <CardHeader
          className="gap-1 cursor-move select-none"
          onPointerDown={handleHeaderPointerDown}
          onPointerMove={handleHeaderPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm">Transform</CardTitle>
              <p
                className="mt-1 break-all text-xs font-medium leading-5 text-foreground/90"
                title={objectLabel}
              >
                {objectLabel}
              </p>
              <CardDescription className="mt-1">
                Drag this panel anywhere. Use it for exact transforms and builder actions.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => setActiveObjectTransformId(null)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void applyRotation("left")}
              disabled={isSaving}
            >
              <RotateCcw className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void applyRotation("right")}
              disabled={isSaving}
            >
              <RotateCw className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveObjectConfigId(activeObject._id);
                setActiveObjectTransformId(null);
              }}
              disabled={isSaving}
            >
              <Settings className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void applyScale(0.2)}
              disabled={!scaleEnabled || isSaving}
            >
              <ZoomIn className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void applyScale(-0.2)}
              disabled={!scaleEnabled || isSaving}
            >
              <ZoomOut className="size-4" />
            </Button>
          </div>

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
                disabled={!scaleEnabled}
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
            <Button type="button" variant="outline" size="sm" onClick={() => setField("y", "0.00")}>
              Snap Y = 0
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetToCurrent}>
              Reset Draft
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Drag the object in-scene to move it. Use this panel for exact values, rotation, scale,
            settings, and delete.
          </p>
          {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
        </CardContent>
        <CardFooter className="justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            X/Z stay clamped to valid tile centers within the current room layout.
          </p>
          <Button type="button" size="sm" onClick={() => void save()} disabled={isSaving}>
            {isSaving ? "Saving..." : "Apply"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
