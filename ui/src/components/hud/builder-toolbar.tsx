/**
 * BUILDER TOOLBAR
 * ===============
 * Builder-only controls for tile-based office layout editing.
 *
 * KEY CONCEPTS:
 * - Builder actions stay outside the speed-dial so layout editing remains one click away.
 * - The scene handles drag painting; this toolbar only selects the active builder tool.
 *
 * USAGE:
 * - Render from `office-simulation.tsx` as a fixed HUD overlay.
 *
 * MEMORY REFERENCES:
 * - MEM-0165
 */

"use client";

import { useEffect } from "react";
import { DoorOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";

export function BuilderToolbar(): JSX.Element | null {
  const { officeSettings } = useOfficeDataContext();
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const activeBuilderTool = useAppStore((state) => state.activeBuilderTool);
  const setActiveBuilderTool = useAppStore((state) => state.setActiveBuilderTool);
  const setBuilderMode = useAppStore((state) => state.setBuilderMode);

  useEffect(() => {
    if (isBuilderMode) return;
    setActiveBuilderTool(null);
  }, [isBuilderMode, setActiveBuilderTool]);

  if (!isBuilderMode) return null;

  const setTool = (tool: "paint-floor" | "remove-floor"): void => {
    setActiveBuilderTool(activeBuilderTool === tool ? null : tool);
  };

  return (
    <div className="pointer-events-auto flex w-60 flex-col gap-3 rounded-2xl border border-border/80 bg-background/92 p-3 shadow-xl backdrop-blur">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Builder
        </p>
        <h3 className="mt-1 text-sm font-semibold text-foreground">Office Area</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Bounds {officeSettings.officeFootprint.width} x {officeSettings.officeFootprint.depth}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <Button
          type="button"
          variant={activeBuilderTool === "paint-floor" ? "default" : "outline"}
          className="h-auto justify-start px-3 py-2.5 text-left"
          onClick={() => setTool("paint-floor")}
        >
          <Plus className="size-4" />
          Add Tiles
        </Button>
        <Button
          type="button"
          variant={activeBuilderTool === "remove-floor" ? "destructive" : "outline"}
          className="h-auto justify-start px-3 py-2.5 text-left"
          onClick={() => setTool("remove-floor")}
        >
          <Trash2 className="size-4" />
          Remove Tiles
        </Button>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">
        Drag on the floor to paint new tiles or remove existing ones, then use the in-scene Apply
        button to commit the stroke. Walls now wrap the floor plan automatically.
      </p>
      <Button
        type="button"
        variant="secondary"
        className="justify-start"
        onClick={() => {
          setActiveBuilderTool(null);
          setBuilderMode(false);
        }}
      >
        <DoorOpen className="size-4" />
        Exit Builder Mode
      </Button>
    </div>
  );
}
