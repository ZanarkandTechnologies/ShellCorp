"use client";

/**
 * OFFICE TOP BAR
 * ==============
 * Top-right strip: Builder mode toggle (always), and when Builder is on:
 * 2.5D view, Humanoid agents, and Office appearance (floor, walls, windows, door, carpet).
 */

import { useCallback } from "react";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export function OfficeTopBar() {
  const isBuilderMode = useAppStore((s) => s.isBuilderMode);
  const setBuilderMode = useAppStore((s) => s.setBuilderMode);
  const isAnimatingCamera = useAppStore((s) => s.isAnimatingCamera);
  const setAnimatingCamera = useAppStore((s) => s.setAnimatingCamera);

  const officeView2_5D = useAppStore((s) => s.officeView2_5D);
  const setOfficeView2_5D = useAppStore((s) => s.setOfficeView2_5D);
  const useHumanoidAvatar = useAppStore((s) => s.useHumanoidAvatar);
  const setUseHumanoidAvatar = useAppStore((s) => s.setUseHumanoidAvatar);
  const roomAppearance = useAppStore((s) => s.roomAppearance);
  const setRoomAppearance = useAppStore((s) => s.setRoomAppearance);
  const ceoDeskHidden = useAppStore((s) => s.ceoDeskHidden);
  const setCeoDeskHidden = useAppStore((s) => s.setCeoDeskHidden);

  const handleBuilderToggle = useCallback(
    (on: boolean) => {
      if (isAnimatingCamera) return;
      if (isBuilderMode === on) return;
      setAnimatingCamera(true);
      setBuilderMode(on);
    },
    [isAnimatingCamera, isBuilderMode, setAnimatingCamera, setBuilderMode],
  );

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col gap-2 rounded-lg border bg-background/95 px-3 py-2 shadow-sm backdrop-blur",
        "min-w-[140px]",
      )}
    >
      {/* Builder mode — always visible */}
      <div className="flex items-center gap-2">
        <Hammer className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Builder</span>
        <div className="ml-auto flex gap-0.5">
          <Button
            size="sm"
            variant={isBuilderMode ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => handleBuilderToggle(true)}
            disabled={isAnimatingCamera}
          >
            On
          </Button>
          <Button
            size="sm"
            variant={!isBuilderMode ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => handleBuilderToggle(false)}
            disabled={isAnimatingCamera}
          >
            Off
          </Button>
        </div>
      </div>

      {/* When builder mode: 2.5D, Humanoid, Office appearance, Restore CEO desk */}
      {isBuilderMode && (
        <div className="flex flex-col gap-2 border-t pt-2">
          {ceoDeskHidden && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-full text-xs"
              onClick={() => setCeoDeskHidden(false)}
            >
              Restore CEO desk
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">2.5D</span>
            <Button
              size="sm"
              variant={officeView2_5D ? "default" : "outline"}
              className="h-6 px-1.5 text-xs"
              onClick={() => setOfficeView2_5D(true)}
            >
              On
            </Button>
            <Button
              size="sm"
              variant={!officeView2_5D ? "default" : "outline"}
              className="h-6 px-1.5 text-xs"
              onClick={() => setOfficeView2_5D(false)}
            >
              Off
            </Button>

            <span className="ml-1 text-xs text-muted-foreground">Humanoid</span>
            <Button
              size="sm"
              variant={useHumanoidAvatar ? "default" : "outline"}
              className="h-6 px-1.5 text-xs"
              onClick={() => setUseHumanoidAvatar(true)}
            >
              On
            </Button>
            <Button
              size="sm"
              variant={!useHumanoidAvatar ? "default" : "outline"}
              className="h-6 px-1.5 text-xs"
              onClick={() => setUseHumanoidAvatar(false)}
            >
              Off
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Office</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                className="h-7 rounded border bg-background px-1.5 text-xs"
                value={roomAppearance.floorType}
                onChange={(e) =>
                  setRoomAppearance({
                    floorType: e.target.value as "wood" | "tile" | "concrete",
                  })
                }
              >
                <option value="wood">Wood</option>
                <option value="tile">Tile</option>
                <option value="concrete">Concrete</option>
              </select>
              <div className="flex items-center gap-0.5">
                <input
                  type="color"
                  value={roomAppearance.floorColor}
                  onChange={(e) =>
                    setRoomAppearance({ floorColor: e.target.value })
                  }
                  className="h-6 w-6 cursor-pointer rounded border"
                  title="Floor"
                />
                <Input
                  value={roomAppearance.floorColor}
                  onChange={(e) =>
                    setRoomAppearance({ floorColor: e.target.value })
                  }
                  className="h-6 w-14 p-1 text-[10px]"
                />
              </div>
              <div className="flex items-center gap-0.5">
                <input
                  type="color"
                  value={roomAppearance.wallColor}
                  onChange={(e) =>
                    setRoomAppearance({ wallColor: e.target.value })
                  }
                  className="h-6 w-6 cursor-pointer rounded border"
                  title="Wall"
                />
              </div>
              <div className="flex items-center gap-0.5">
                <input
                  type="color"
                  value={roomAppearance.carpetColor}
                  onChange={(e) =>
                    setRoomAppearance({ carpetColor: e.target.value })
                  }
                  className="h-6 w-6 cursor-pointer rounded border"
                  title="Carpet"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant={roomAppearance.windows ? "default" : "outline"}
                className="h-6 px-1.5 text-xs"
                onClick={() =>
                  setRoomAppearance({ windows: !roomAppearance.windows })
                }
              >
                Win
              </Button>
              <Button
                size="sm"
                variant={roomAppearance.paintings ? "default" : "outline"}
                className="h-6 px-1.5 text-xs"
                onClick={() =>
                  setRoomAppearance({ paintings: !roomAppearance.paintings })
                }
              >
                Art
              </Button>
              <Button
                size="sm"
                variant={roomAppearance.door ? "default" : "outline"}
                className="h-6 px-1.5 text-xs"
                onClick={() =>
                  setRoomAppearance({ door: !roomAppearance.door })
                }
              >
                Door
              </Button>
              <Button
                size="sm"
                variant={roomAppearance.carpet ? "default" : "outline"}
                className="h-6 px-1.5 text-xs"
                onClick={() =>
                  setRoomAppearance({ carpet: !roomAppearance.carpet })
                }
              >
                Carpet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
