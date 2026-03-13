"use client";

/**
 * OBJECT INTERACTION PANEL
 * ========================
 * Shared runtime viewer for office objects that expose modal-backed interactions.
 *
 * KEY CONCEPTS:
 * - Reads app-store-routed object interaction state
 * - Renders iframe embeds with graceful fallback guidance
 * - Keeps runtime object interactions routed through app state instead of local modal flags
 *
 * USAGE:
 * - Opened by `InteractiveObject` when a runtime uiBinding is configured
 *
 * MEMORY REFERENCES:
 * - MEM-0108
 * - MEM-0109
 */

import { ExternalLink, Globe2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/app-store";
import { UI_Z } from "@/lib/z-index";
import { endObjectInteractionTrace } from "../utils/object-interaction-perf";

function getFrameClassName(aspectRatio: "wide" | "square" | "tall" | undefined): string {
  switch (aspectRatio) {
    case "square":
      return "aspect-square";
    case "tall":
      return "aspect-[4/5]";
    default:
      return "aspect-[16/10]";
  }
}

export function ObjectInteractionPanel() {
  const activeObjectPanel = useAppStore((state) => state.activeObjectPanel);
  const setActiveObjectPanel = useAppStore((state) => state.setActiveObjectPanel);
  const setSelectedObjectId = useAppStore((state) => state.setSelectedObjectId);
  const panelTitle = activeObjectPanel?.title ?? activeObjectPanel?.displayName ?? "Object Panel";
  const panelUrl = activeObjectPanel?.url ?? "";

  const [hasLoaded, setHasLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    setHasLoaded(false);
    setShowFallback(false);
    if (!activeObjectPanel || !panelUrl) return;
    const timer = window.setTimeout(() => {
      setShowFallback(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeObjectPanel, panelUrl]);

  useEffect(() => {
    if (!activeObjectPanel) return;
    // Clear any stale radial menu only after the modal is live; doing it on click made the open path feel slower.
    if (useAppStore.getState().selectedObjectId !== null) {
      setSelectedObjectId(null);
    }
    const modalReadyLatencyMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        activeObjectPanel.openedAtMs,
    );
    if (import.meta.env.DEV) {
      console.debug("[perf] office-object-modal-ready", {
        objectId: String(activeObjectPanel.objectId),
        modalReadyLatencyMs,
      });
    }
    endObjectInteractionTrace("runtime-panel", String(activeObjectPanel.objectId), "ready", {
      modalReadyLatencyMs,
    });
  }, [activeObjectPanel, setSelectedObjectId]);

  const aspectRatio = activeObjectPanel?.aspectRatio;

  return (
    <Dialog open={!!activeObjectPanel} onOpenChange={(open) => !open && setActiveObjectPanel(null)}>
      <DialogContent
        className="flex h-[min(90vh,860px)] max-w-[94vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <div className="border-b px-5 py-3">
          <DialogHeader>
            <DialogTitle>{panelTitle}</DialogTitle>
            <DialogDescription>
              Runtime object modal. If the embed is blocked by the source site, open it in a new
              tab.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                <p className="truncate text-sm font-medium">{panelTitle}</p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {panelUrl || "No runtime URL configured."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!panelUrl}
              onClick={() => panelUrl && window.open(panelUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open In New Tab
            </Button>
          </div>

          {showFallback && !hasLoaded ? (
            <div className="mx-5 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Embed may be blocked</p>
                  <p className="text-sm text-muted-foreground">
                    Some sites do not allow iframe embedding. If the viewer stays blank, use the
                    external-open button above.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-4">
            {panelUrl ? (
              <div
                className={`w-full overflow-hidden rounded-xl border bg-background shadow-sm ${getFrameClassName(aspectRatio)}`}
              >
                <iframe
                  title={panelTitle}
                  src={panelUrl}
                  className="h-full w-full"
                  onLoad={() => {
                    setHasLoaded(true);
                    if (!activeObjectPanel || !import.meta.env.DEV) return;
                    const iframeReadyLatencyMs = Math.round(
                      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
                        activeObjectPanel.openedAtMs,
                    );
                    console.debug("[perf] office-object-iframe-load", {
                      objectId: String(activeObjectPanel.objectId),
                      iframeReadyLatencyMs,
                    });
                  }}
                />
              </div>
            ) : (
              <div className="w-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                This object does not currently have a runtime panel URL.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
