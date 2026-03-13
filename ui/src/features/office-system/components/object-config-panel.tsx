"use client";

/**
 * OBJECT CONFIG PANEL
 * ===================
 * Builder-mode configuration surface for office-object interaction metadata.
 *
 * KEY CONCEPTS:
 * - Persists object UI bindings inside existing office-object `metadata`
 * - Keeps builder configuration routed through app-store panel state
 * - Seeds embed-first runtime behavior while reserving future skill bindings
 *
 * USAGE:
 * - Open from `InteractiveObject` settings in builder mode
 * - Save label/embed config for any non-team office object
 *
 * MEMORY REFERENCES:
 * - MEM-0108
 * - MEM-0109
 */

import { ExternalLink, Globe2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/app-store";
import { UI_Z } from "@/lib/z-index";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

import {
  buildOfficeObjectMetadata,
  normalizeHttpUrl,
  type OfficeObjectUiBinding,
  parseOfficeObjectInteractionConfig,
} from "../office-object-ui";
import { endObjectInteractionTrace } from "../utils/object-interaction-perf";
import { resolvePersistedOfficeObjectId } from "./office-object-id";

const WORLD_MONITOR_PRESET = {
  title: "World Monitor",
  url: "https://earth.nullschool.net/",
  aspectRatio: "wide" as const,
};

export function ObjectConfigPanel() {
  const activeObjectConfigId = useAppStore((state) => state.activeObjectConfigId);
  const setActiveObjectConfigId = useAppStore((state) => state.setActiveObjectConfigId);
  const isBuilderMode = useAppStore((state) => state.isBuilderMode);
  const { officeObjects } = useOfficeDataContext();
  const adapter = useOpenClawAdapter();

  const officeObject = useMemo(
    () => officeObjects.find((item) => item._id === activeObjectConfigId) ?? null,
    [activeObjectConfigId, officeObjects],
  );
  const parsedConfig = useMemo(
    () => parseOfficeObjectInteractionConfig(officeObject?.metadata),
    [officeObject?.metadata],
  );

  const [displayName, setDisplayName] = useState("");
  const [isInteractiveEnabled, setIsInteractiveEnabled] = useState(false);
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"wide" | "square" | "tall">("wide");
  const [isSkillBindingEnabled, setIsSkillBindingEnabled] = useState(false);
  const [skillId, setSkillId] = useState("");
  const [skillLabel, setSkillLabel] = useState("");
  const [skillEffectMode, setSkillEffectMode] = useState<"fixed" | "random">("fixed");
  const [skillEffectVariant, setSkillEffectVariant] = useState<"ghost" | "blink">("ghost");
  const [effectPoolGhost, setEffectPoolGhost] = useState(true);
  const [effectPoolBlink, setEffectPoolBlink] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeObjectConfigId || !officeObject) return;
    setDisplayName(parsedConfig.displayName ?? "");
    setIsInteractiveEnabled(parsedConfig.uiBinding.kind === "embed");
    setEmbedTitle(parsedConfig.uiBinding.kind === "embed" ? parsedConfig.uiBinding.title : "");
    setEmbedUrl(parsedConfig.uiBinding.kind === "embed" ? parsedConfig.uiBinding.url : "");
    setAspectRatio(
      parsedConfig.uiBinding.kind === "embed" && parsedConfig.uiBinding.aspectRatio
        ? parsedConfig.uiBinding.aspectRatio
        : "wide",
    );
    setIsSkillBindingEnabled(Boolean(parsedConfig.skillBinding?.skillId));
    setSkillId(parsedConfig.skillBinding?.skillId ?? "");
    setSkillLabel(parsedConfig.skillBinding?.label ?? "");
    setSkillEffectMode(parsedConfig.skillBinding?.effectMode ?? "fixed");
    setSkillEffectVariant(parsedConfig.skillBinding?.effectVariant ?? "ghost");
    setEffectPoolGhost(parsedConfig.skillBinding?.effectPool?.includes("ghost") ?? true);
    setEffectPoolBlink(parsedConfig.skillBinding?.effectPool?.includes("blink") ?? true);
    setStatusText("");
    endObjectInteractionTrace("builder-panel", String(activeObjectConfigId), "ready", {
      meshType: officeObject.meshType,
    });
  }, [activeObjectConfigId, officeObject, parsedConfig]);

  useEffect(() => {
    if (isBuilderMode) return;
    setActiveObjectConfigId(null);
  }, [isBuilderMode, setActiveObjectConfigId]);

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      setActiveObjectConfigId(null);
    }
  };

  async function handleSave(): Promise<void> {
    if (!officeObject) return;
    setStatusText("");
    const normalizedUrl = normalizeHttpUrl(embedUrl);
    if (isInteractiveEnabled) {
      if (!embedTitle.trim()) {
        setStatusText("Embed title is required when object interaction is enabled.");
        return;
      }
      if (!normalizedUrl) {
        setStatusText("Embed URL must be a valid http(s) address.");
        return;
      }
    }
    if (isSkillBindingEnabled && !skillId.trim()) {
      setStatusText("Skill ID is required when skill binding is enabled.");
      return;
    }

    setIsSaving(true);
    try {
      const current = await adapter.getOfficeObjects();
      const knownIds = new Set(current.map((item) => item.id));
      const persistedId = resolvePersistedOfficeObjectId(String(officeObject._id), knownIds);
      const existing = current.find((item) => item.id === persistedId);
      const nextUiBinding: OfficeObjectUiBinding = isInteractiveEnabled
        ? {
            kind: "embed",
            title: embedTitle.trim(),
            url: normalizedUrl ?? "",
            openMode: "panel",
            aspectRatio,
          }
        : { kind: "none" };
      const nextSkillBinding = isSkillBindingEnabled
        ? {
            skillId: skillId.trim(),
            label: skillLabel.trim() || undefined,
            effectMode: skillEffectMode,
            effectVariant: skillEffectMode === "fixed" ? skillEffectVariant : undefined,
            effectPool:
              skillEffectMode === "random"
                ? [
                    ...(effectPoolGhost ? (["ghost"] as const) : []),
                    ...(effectPoolBlink ? (["blink"] as const) : []),
                  ]
                : undefined,
          }
        : null;
      if (
        isSkillBindingEnabled &&
        skillEffectMode === "random" &&
        !effectPoolGhost &&
        !effectPoolBlink
      ) {
        setStatusText("Choose at least one random effect variant.");
        setIsSaving(false);
        return;
      }
      const metadata = buildOfficeObjectMetadata(existing?.metadata ?? officeObject.metadata, {
        displayName: displayName.trim() || undefined,
        uiBinding: nextUiBinding,
        skillBinding: nextSkillBinding,
      });
      const result = await adapter.upsertOfficeObject(
        {
          id: persistedId,
          identifier: existing?.identifier ?? persistedId,
          meshType: existing?.meshType ?? officeObject.meshType,
          position: existing?.position ?? officeObject.position,
          rotation: existing?.rotation ?? officeObject.rotation,
          scale: existing?.scale ?? officeObject.scale,
          metadata,
        },
        { currentObjects: current },
      );
      if (!result.ok) {
        setStatusText(result.error ?? "Failed to save object config.");
        return;
      }
      setStatusText("Object configuration saved.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "object_config_save_failed");
    } finally {
      setIsSaving(false);
    }
  }

  const objectTypeLabel = officeObject?.meshType.split("-").join(" ") ?? "office object";

  return (
    <Dialog open={!!activeObjectConfigId && isBuilderMode} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[min(88vh,820px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]"
        style={{ zIndex: UI_Z.panelElevated }}
      >
        <div className="border-b px-6 py-4">
          <DialogHeader>
            <DialogTitle>Object Builder</DialogTitle>
            <DialogDescription>
              Configure runtime UI behavior for this {objectTypeLabel}. Outside builder mode,
              configured objects open their assigned panel instead of builder controls.
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-6 py-4">
            <section className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Display</h3>
                <p className="text-xs text-muted-foreground">
                  Override the object label used in menus and runtime panels.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="object-display-name">Label Override</Label>
                <Input
                  id="object-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Optional custom object label"
                />
              </div>
            </section>

            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Runtime Interaction</h3>
                  <p className="text-xs text-muted-foreground">
                    Enable a panel-driven embed when the object is clicked outside builder mode.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="object-interactive-enabled"
                    checked={isInteractiveEnabled}
                    onCheckedChange={(checked) => setIsInteractiveEnabled(checked === true)}
                  />
                  <Label htmlFor="object-interactive-enabled">Enabled</Label>
                </div>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Some websites block iframe embedding with CSP or `X-Frame-Options`. The runtime
                panel includes an external-open fallback for those cases.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsInteractiveEnabled(true);
                    setEmbedTitle(WORLD_MONITOR_PRESET.title);
                    setEmbedUrl(WORLD_MONITOR_PRESET.url);
                    setAspectRatio(WORLD_MONITOR_PRESET.aspectRatio);
                  }}
                >
                  <Globe2 className="mr-2 h-4 w-4" />
                  Load World Monitor Example
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!normalizeHttpUrl(embedUrl)}
                  onClick={() => {
                    const url = normalizeHttpUrl(embedUrl);
                    if (url) window.open(url, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview URL
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-embed-title">Embed Title</Label>
                <Input
                  id="object-embed-title"
                  value={embedTitle}
                  onChange={(event) => setEmbedTitle(event.target.value)}
                  placeholder="World Monitor"
                  disabled={!isInteractiveEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-embed-url">Embed URL</Label>
                <Input
                  id="object-embed-url"
                  value={embedUrl}
                  onChange={(event) => setEmbedUrl(event.target.value)}
                  placeholder="https://earth.nullschool.net/"
                  disabled={!isInteractiveEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-embed-aspect">Panel Aspect</Label>
                <select
                  id="object-embed-aspect"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={aspectRatio}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "wide" || next === "square" || next === "tall") {
                      setAspectRatio(next);
                    }
                  }}
                  disabled={!isInteractiveEnabled}
                >
                  <option value="wide">Wide</option>
                  <option value="square">Square</option>
                  <option value="tall">Tall</option>
                </select>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Skill Binding</h3>
                  <p className="text-xs text-muted-foreground">
                    Bind this object to a skill ID so active agent status can snap avatars next to
                    it.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="object-skill-binding-enabled"
                    checked={isSkillBindingEnabled}
                    onCheckedChange={(checked) => setIsSkillBindingEnabled(checked === true)}
                  />
                  <Label htmlFor="object-skill-binding-enabled">Enabled</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-skill-id">Skill ID</Label>
                <Input
                  id="object-skill-id"
                  value={skillId}
                  onChange={(event) => setSkillId(event.target.value)}
                  placeholder="world-monitor"
                  disabled={!isSkillBindingEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-skill-label">Skill Label</Label>
                <Input
                  id="object-skill-label"
                  value={skillLabel}
                  onChange={(event) => setSkillLabel(event.target.value)}
                  placeholder="World Monitor"
                  disabled={!isSkillBindingEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="object-skill-effect-mode">Effect Mode</Label>
                <select
                  id="object-skill-effect-mode"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={skillEffectMode}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (next === "fixed" || next === "random") {
                      setSkillEffectMode(next);
                    }
                  }}
                  disabled={!isSkillBindingEnabled}
                >
                  <option value="fixed">Fixed</option>
                  <option value="random">Random</option>
                </select>
              </div>

              {skillEffectMode === "fixed" ? (
                <div className="space-y-2">
                  <Label htmlFor="object-skill-effect-variant">Effect Variant</Label>
                  <select
                    id="object-skill-effect-variant"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={skillEffectVariant}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next === "ghost" || next === "blink") {
                        setSkillEffectVariant(next);
                      }
                    }}
                    disabled={!isSkillBindingEnabled}
                  >
                    <option value="ghost">Ghost Projection</option>
                    <option value="blink">Blink Teleport</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Random Effect Pool</p>
                    <p className="text-xs text-muted-foreground">
                      Pick the effect variants this object can use when a skill call starts.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="object-skill-effect-pool-ghost"
                      checked={effectPoolGhost}
                      onCheckedChange={(checked) => setEffectPoolGhost(checked === true)}
                      disabled={!isSkillBindingEnabled}
                    />
                    <Label htmlFor="object-skill-effect-pool-ghost">Ghost Projection</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="object-skill-effect-pool-blink"
                      checked={effectPoolBlink}
                      onCheckedChange={(checked) => setEffectPoolBlink(checked === true)}
                      disabled={!isSkillBindingEnabled}
                    />
                    <Label htmlFor="object-skill-effect-pool-blink">Blink Teleport</Label>
                  </div>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{statusText}</p>
              <Button onClick={() => void handleSave()} disabled={!officeObject || isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save Object Config"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
