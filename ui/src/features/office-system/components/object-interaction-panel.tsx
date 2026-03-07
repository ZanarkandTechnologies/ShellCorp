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

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Globe2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/app-store";
import { UI_Z } from "@/lib/z-index";
import { useOfficeDataContext } from "@/providers/office-data-provider";

import { parseOfficeObjectInteractionConfig } from "../office-object-ui";

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
  const { officeObjects } = useOfficeDataContext();

  const officeObject = useMemo(
    () => officeObjects.find((item) => item._id === activeObjectPanel?.objectId) ?? null,
    [activeObjectPanel?.objectId, officeObjects],
  );
  const interactionConfig = useMemo(
    () => parseOfficeObjectInteractionConfig(officeObject?.metadata),
    [officeObject?.metadata],
  );

  const panelTitle =
    interactionConfig.uiBinding.kind === "embed"
      ? interactionConfig.uiBinding.title
      : activeObjectPanel?.title ?? interactionConfig.displayName ?? "Object Panel";
  const panelUrl =
    interactionConfig.uiBinding.kind === "embed"
      ? interactionConfig.uiBinding.url
      : activeObjectPanel?.url ?? "";

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

  const aspectRatio =
    interactionConfig.uiBinding.kind === "embed" ? interactionConfig.uiBinding.aspectRatio : undefined;

  return (
    <Dialog open={!!activeObjectPanel} onOpenChange={(open) => !open && setActiveObjectPanel(null)}>
      <DialogContent
        className="flex h-[min(90vh,860px)] max-w-[94vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <div className="border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle>{panelTitle}</DialogTitle>
            <DialogDescription>
              Runtime object modal. If the embed is blocked by the source site, open it in a new tab.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">{panelTitle}</p>
                  <p className="text-xs text-muted-foreground">{panelUrl || "No runtime URL configured."}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!panelUrl}
                onClick={() => panelUrl && window.open(panelUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open In New Tab
              </Button>
            </div>

            {showFallback && !hasLoaded ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-5 w-5 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Embed may be blocked</p>
                    <p className="text-sm text-muted-foreground">
                      Some sites do not allow iframe embedding. If the viewer stays blank, use the external-open button above.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {panelUrl ? (
              <div className={`overflow-hidden rounded-xl border bg-background ${getFrameClassName(aspectRatio)}`}>
                <iframe
                  title={panelTitle}
                  src={panelUrl}
                  className="h-full w-full"
                  onLoad={() => setHasLoaded(true)}
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                This object does not currently have a runtime panel URL.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
