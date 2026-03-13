/**
 * Furniture Shop Component
 *
 * This shop allows users to purchase furniture and equipment for their office.
 *
 * Architecture:
 * - Desks: Team-based (must select a team). Increments team.deskCount, procedurally rendered.
 * - Future items (plants, decorations, etc.): Can be either:
 *   1. Team-based: Assigned to a team cluster (similar to desks)
 *   2. Coordinate-based: User clicks on the floor to place (uses PlacementHandler)
 *
 * Item Types:
 * - "desk": Team-based, procedural placement, increments deskCount
 * - "plant": (Future) Coordinate-based, physical object stored in officeObjects
 * - "decoration": (Future) Coordinate-based, physical object stored in officeObjects
 * - "meeting-room": (Future) Coordinate-based, physical object with special dimensions
 *
 * To add a new item type:
 * 1. Add to the items array with: { id, name, price, description, placementType }
 * 2. If placementType === "team": Requires team selection, update handleBuyAndPlace
 * 3. If placementType === "coordinate": Use setPlacementMode to trigger PlacementHandler
 * 4. Add corresponding gateway-backed adapter method if needed
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlacementSystem } from "@/features/office-system/systems/placement-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MeshAssetModel } from "@/lib/openclaw-types";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Store,
  Box,
  CloudDownload,
  Monitor,
  Download,
  Package,
  Sofa,
  Library,
  Briefcase,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getBackgroundPreset,
  getPaintingPreset,
  getWallArtSlots,
  OFFICE_BACKGROUND_PRESETS,
  OFFICE_DECOR_PACKS,
  OFFICE_FLOOR_PATTERN_PRESETS,
  OFFICE_PAINTING_PRESETS,
  OFFICE_WALL_COLOR_PRESETS,
  type OfficeBackgroundId,
  type OfficeFloorPatternId,
  type OfficePaintingPresetId,
  type OfficeWallColorId,
  type WallArtSlotId,
} from "@/lib/office-decor";

type TabId = "catalog" | "decor" | "custom" | "import";

interface BuiltInCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BUILT_IN_ITEMS: BuiltInCatalogItem[] = [
  {
    id: "desk",
    name: "Office Desk",
    description: "Standard workstation desk included with the core office kit.",
    category: "Furniture",
    icon: Monitor,
  },
  {
    id: "couch",
    name: "Lounge Couch",
    description: "Minimal waiting area couch for team collaboration spaces.",
    category: "Lounge",
    icon: Sofa,
  },
  {
    id: "bookshelf",
    name: "Bookshelf",
    description: "Neutral storage shelf for office props and decor scenes.",
    category: "Storage",
    icon: Library,
  },
  {
    id: "pantry",
    name: "Pantry Counter",
    description: "Pantry module for kitchen corners and social zones.",
    category: "Utility",
    icon: Briefcase,
  },
];

interface FurnitureShopProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FurnitureShop({ isOpen, onOpenChange }: FurnitureShopProps) {
  const { company, officeSettings, officeObjects, refresh } = useOfficeDataContext();
  const { startPlacement } = usePlacementSystem();
  const adapter = useOpenClawAdapter();

  const [activeTab, setActiveTab] = useState<TabId>("catalog");
  const [meshAssets, setMeshAssets] = useState<MeshAssetModel[]>([]);
  const [failedPreviewByAssetId, setFailedPreviewByAssetId] = useState<Record<string, boolean>>({});
  const [meshAssetDir, setMeshAssetDir] = useState("");
  const [meshUrlInput, setMeshUrlInput] = useState("");
  const [meshLabelInput, setMeshLabelInput] = useState("");
  const [isDownloadingMesh, setIsDownloadingMesh] = useState(false);
  const [isSavingDir, setIsSavingDir] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [meshError, setMeshError] = useState<string | null>(null);
  const [decorStatus, setDecorStatus] = useState<string | null>(null);
  const [isSavingDecor, setIsSavingDecor] = useState(false);
  const [draftFloorPatternId, setDraftFloorPatternId] = useState<OfficeFloorPatternId>(
    officeSettings.decor.floorPatternId,
  );
  const [draftWallColorId, setDraftWallColorId] = useState<OfficeWallColorId>(
    officeSettings.decor.wallColorId,
  );
  const [draftBackgroundId, setDraftBackgroundId] = useState<OfficeBackgroundId>(
    officeSettings.decor.backgroundId,
  );

  const hasMeshAssets = meshAssets.length > 0;

  const sortedMeshAssets = useMemo(
    () => [...meshAssets].sort((a, b) => b.addedAt - a.addedAt),
    [meshAssets],
  );
  const wallArtSlots = useMemo(
    () => getWallArtSlots(officeSettings.officeFootprint),
    [officeSettings.officeFootprint],
  );
  const wallArtBySlotId = useMemo(() => {
    const next = new Map<WallArtSlotId, (typeof officeObjects)[number]>();
    for (const object of officeObjects) {
      if (object.meshType !== "wall-art") continue;
      const slotId =
        typeof object.metadata?.wallSlotId === "string"
          ? (object.metadata.wallSlotId as WallArtSlotId)
          : null;
      if (slotId) {
        next.set(slotId, object);
      }
    }
    return next;
  }, [officeObjects]);

  const getAssetPathBase = (publicPath: string): string => publicPath.replace(/\.(glb|gltf)$/i, "");

  const getPreviewCandidatePath = (publicPath: string): string =>
    `${getAssetPathBase(publicPath)}.preview.png`;

  const formatFileSize = (bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes <= 0) return "n/a";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const loadMeshAssets = async () => {
    setIsLoadingAssets(true);
    setMeshError(null);
    try {
      const [settingsResult, assetsResult] = await Promise.all([
        adapter.getOfficeSettings(),
        adapter.listMeshAssets(),
      ]);
      setMeshAssetDir(settingsResult.meshAssetDir || assetsResult.meshAssetDir || "");
      setMeshAssets(assetsResult.assets);
    } catch {
      setMeshError("Failed to load custom mesh assets.");
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadMeshAssets();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setFailedPreviewByAssetId({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setDraftFloorPatternId(officeSettings.decor.floorPatternId);
    setDraftWallColorId(officeSettings.decor.wallColorId);
    setDraftBackgroundId(officeSettings.decor.backgroundId);
    setDecorStatus(null);
  }, [
    isOpen,
    officeSettings.decor.backgroundId,
    officeSettings.decor.floorPatternId,
    officeSettings.decor.wallColorId,
  ]);

  const handleSaveMeshDir = async () => {
    const nextDir = meshAssetDir.trim();
    if (!nextDir) {
      setMeshError("Mesh asset folder path is required.");
      return;
    }
    setIsSavingDir(true);
    setMeshError(null);
    const currentSettings = await adapter.getOfficeSettings();
    const result = await adapter.saveOfficeSettings({ ...currentSettings, meshAssetDir: nextDir });
    setIsSavingDir(false);
    if (!result.ok) {
      setMeshError(result.error ?? "Failed to save mesh folder setting.");
      return;
    }
    setMeshAssetDir(result.settings.meshAssetDir);
    await loadMeshAssets();
  };

  const handleDownloadMesh = async () => {
    const url = meshUrlInput.trim();
    if (!url) {
      setMeshError("Mesh URL is required.");
      return;
    }
    setIsDownloadingMesh(true);
    setMeshError(null);
    const result = await adapter.downloadMeshAsset({
      url,
      label: meshLabelInput.trim() || undefined,
    });
    setIsDownloadingMesh(false);
    if (!result.ok) {
      setMeshError(result.error ?? "Failed to download mesh.");
      return;
    }
    setMeshUrlInput("");
    setMeshLabelInput("");
    await loadMeshAssets();
  };

  const handleApplyDecor = async () => {
    setIsSavingDecor(true);
    setDecorStatus(null);
    try {
      const result = await adapter.saveOfficeSettings({
        ...officeSettings,
        decor: {
          floorPatternId: draftFloorPatternId,
          wallColorId: draftWallColorId,
          backgroundId: draftBackgroundId,
        },
      });
      if (!result.ok) {
        setDecorStatus(result.error ?? "Failed to save office decor.");
        return;
      }
      setDecorStatus("Applying view and reloading...");
      onOpenChange(false);
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          window.location.reload();
        }, 50);
        return;
      }
      await refresh();
      setDecorStatus("Decoration view applied.");
    } catch (error) {
      setDecorStatus(error instanceof Error ? error.message : "Failed to save office decor.");
    } finally {
      setIsSavingDecor(false);
    }
  };

  const handlePlacePainting = async (
    slotId: WallArtSlotId,
    paintingPresetId: OfficePaintingPresetId,
  ) => {
    const slot = wallArtSlots.find((entry) => entry.id === slotId);
    if (!slot) return;
    setIsSavingDecor(true);
    setDecorStatus(null);
    try {
      const currentObjects = await adapter.getOfficeObjects();
      const preset = getPaintingPreset(paintingPresetId);
      const result = await adapter.upsertOfficeObject(
        {
          id: `wall-art-${slotId}`,
          identifier: `wall-art-${slotId}`,
          meshType: "wall-art",
          position: slot.position,
          rotation: slot.rotation,
          metadata: {
            wallSlotId: slotId,
            paintingPresetId,
            displayName: preset.label,
          },
        },
        { currentObjects },
      );
      if (!result.ok) {
        setDecorStatus(result.error ?? "Failed to place painting.");
        return;
      }
      await refresh();
      setDecorStatus(`${preset.label} placed on ${slot.label}.`);
    } catch (error) {
      setDecorStatus(error instanceof Error ? error.message : "Failed to place painting.");
    } finally {
      setIsSavingDecor(false);
    }
  };

  const handleClearPainting = async (slotId: WallArtSlotId) => {
    setIsSavingDecor(true);
    setDecorStatus(null);
    try {
      const currentObjects = await adapter.getOfficeObjects();
      const result = await adapter.deleteOfficeObject(`wall-art-${slotId}`, { currentObjects });
      if (!result.ok) {
        setDecorStatus(result.error ?? "Failed to clear painting.");
        return;
      }
      await refresh();
      setDecorStatus("Painting removed.");
    } catch (error) {
      setDecorStatus(error instanceof Error ? error.message : "Failed to clear painting.");
    } finally {
      setIsSavingDecor(false);
    }
  };

  const startCustomMeshPlacement = (asset: MeshAssetModel) => {
    if (!company) return;
    onOpenChange(false);
    startPlacement("custom-mesh", {
      companyId: company._id,
      itemName: asset.label,
      meshAssetId: asset.assetId,
      meshPublicPath: asset.publicPath,
      meshLocalPath: asset.localPath,
      displayName: asset.label,
      sourceUrl: asset.sourceUrl,
      scale: [1, 1, 1],
    });
  };

  const renderCatalog = () => (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card text-card-foreground p-5">
        <div>
          <h3 className="font-semibold text-lg">Built-in Catalog</h3>
          <p className="text-sm text-muted-foreground">
            Static assets bundled with ShellCorp. These are fast to load and always available.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-4">Available Items</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILT_IN_ITEMS.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col overflow-hidden border-border/70 shadow-none"
            >
              <div className="h-28 bg-muted/40 flex items-center justify-center border-b">
                <item.icon className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.name}</CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              </CardHeader>
              <CardContent className="pt-0 pb-4 mt-auto">
                <span className="inline-flex rounded-md border px-2 py-1 text-xs text-muted-foreground">
                  {item.category}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCustomLibrary = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Library</h3>
          <p className="text-sm text-muted-foreground">
            Imported GLB/GLTF assets with optional sidecar previews.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void loadMeshAssets()}
          disabled={isLoadingAssets}
        >
          {isLoadingAssets ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {hasMeshAssets ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedMeshAssets.map((asset) => (
            <Card key={asset.assetId} className="flex flex-col">
              <div className="h-28 bg-muted/40 flex items-center justify-center border-b overflow-hidden">
                {!failedPreviewByAssetId[asset.assetId] ? (
                  <img
                    src={getPreviewCandidatePath(asset.publicPath)}
                    alt={`${asset.label} preview`}
                    className="h-full w-full object-cover"
                    onError={() =>
                      setFailedPreviewByAssetId((current) => ({
                        ...current,
                        [asset.assetId]: true,
                      }))
                    }
                  />
                ) : (
                  <Package className="w-8 h-8 text-muted-foreground/50" />
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm truncate" title={asset.label}>
                  {asset.label}
                </CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-2">{asset.fileName}</p>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground mt-auto pb-4">
                <p>{formatFileSize(asset.fileSizeBytes)}</p>
                <p className="truncate" title={asset.localPath}>
                  {asset.localPath}
                </p>
              </CardContent>
              <CardFooter className="pt-0">
                <Button className="w-full" onClick={() => startCustomMeshPlacement(asset)}>
                  Place Mesh
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
          <Box className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No custom meshes found</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            You haven't downloaded any custom meshes yet. Go to the Import tab to add some.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => setActiveTab("import")}>
            Go to Import
          </Button>
        </div>
      )}
    </div>
  );

  const renderImport = () => (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold">Import Custom Assets</h3>
        <p className="text-sm text-muted-foreground">
          Download new .glb/.gltf files and optionally add lightweight preview metadata for catalog
          cards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download from URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mesh-url">Mesh URL</Label>
            <Input
              id="mesh-url"
              value={meshUrlInput}
              onChange={(event) => setMeshUrlInput(event.target.value)}
              placeholder="https://example.com/model.glb"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mesh-label">Label (Optional)</Label>
            <Input
              id="mesh-label"
              value={meshLabelInput}
              onChange={(event) => setMeshLabelInput(event.target.value)}
              placeholder="e.g., cyber-desk"
            />
          </div>
          {meshError && <p className="text-sm text-destructive">{meshError}</p>}
        </CardContent>
        <CardFooter>
          <Button onClick={() => void handleDownloadMesh()} disabled={isDownloadingMesh}>
            {isDownloadingMesh ? "Downloading..." : "Download to Mesh Folder"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="w-4 h-4" />
            Local Mesh Folder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can manually copy `.glb`/`.gltf` files into this folder.
          </p>
          <div className="space-y-2">
            <Label htmlFor="mesh-asset-dir">Folder Path</Label>
            <div className="flex gap-2">
              <Input
                id="mesh-asset-dir"
                value={meshAssetDir}
                onChange={(event) => setMeshAssetDir(event.target.value)}
                placeholder="~/.openclaw/assets/meshes"
              />
              <Button
                onClick={() => void handleSaveMeshDir()}
                disabled={isSavingDir}
                variant="secondary"
              >
                {isSavingDir ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview Convention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>For `chair.glb`, add `chair.preview.png` in the same folder.</p>
          <p className="font-mono text-xs">{"chair.glb -> chair.preview.png"}</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderDecor = () => (
    <div className="space-y-8 max-w-5xl">
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-lg font-semibold">Office Decor</h3>
        <p className="text-sm text-muted-foreground">
          Keep the MVP simple: choose a floor pattern, choose a wall color, and snap paintings to a
          few curated wall slots.
        </p>
        {decorStatus ? <p className="mt-3 text-sm text-muted-foreground">{decorStatus}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void handleApplyDecor()} disabled={isSavingDecor}>
            {isSavingDecor ? "Applying..." : "Apply View"}
          </Button>
          <Button
            variant="outline"
            disabled={isSavingDecor}
            onClick={() => {
              setDraftFloorPatternId(officeSettings.decor.floorPatternId);
              setDraftWallColorId(officeSettings.decor.wallColorId);
              setDraftBackgroundId(officeSettings.decor.backgroundId);
              setDecorStatus("Decoration draft reset.");
            }}
          >
            Reset Draft
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Decor Packs</h3>
          <p className="text-sm text-muted-foreground">
            Cohesive floor, wall, and void-background pairings that look better together than the
            raw presets.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {OFFICE_DECOR_PACKS.map((pack) => (
            <Card key={pack.id} className="flex flex-col overflow-hidden">
              <div className="h-28 border-b" style={{ backgroundImage: pack.preview }} />
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{pack.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{pack.description}</p>
              </CardHeader>
              <CardContent className="pt-0 pb-4 text-xs text-muted-foreground">
                <p>
                  Floor:{" "}
                  {
                    OFFICE_FLOOR_PATTERN_PRESETS.find((preset) => preset.id === pack.floorPatternId)
                      ?.label
                  }
                </p>
                <p>
                  Walls:{" "}
                  {
                    OFFICE_WALL_COLOR_PRESETS.find((preset) => preset.id === pack.wallColorId)
                      ?.label
                  }
                </p>
                <p>Background: {getBackgroundPreset(pack.backgroundId).label}</p>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={
                    draftFloorPatternId === pack.floorPatternId &&
                    draftWallColorId === pack.wallColorId &&
                    draftBackgroundId === pack.backgroundId
                      ? "secondary"
                      : "outline"
                  }
                  disabled={isSavingDecor}
                  onClick={() => {
                    setDraftFloorPatternId(pack.floorPatternId);
                    setDraftWallColorId(pack.wallColorId);
                    setDraftBackgroundId(pack.backgroundId);
                    setDecorStatus(`${pack.label} loaded into the draft.`);
                  }}
                >
                  {draftFloorPatternId === pack.floorPatternId &&
                  draftWallColorId === pack.wallColorId &&
                  draftBackgroundId === pack.backgroundId
                    ? "Selected"
                    : "Use Pack"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Floor Pattern</h3>
          <p className="text-sm text-muted-foreground">
            A few bundled options for the office floor.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {OFFICE_FLOOR_PATTERN_PRESETS.map((preset) => (
            <Card key={preset.id} className="flex flex-col">
              <div className="h-24 border-b" style={{ backgroundImage: preset.swatch }} />
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{preset.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </CardHeader>
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={draftFloorPatternId === preset.id ? "secondary" : "outline"}
                  disabled={isSavingDecor}
                  onClick={() => setDraftFloorPatternId(preset.id)}
                >
                  {draftFloorPatternId === preset.id ? "Selected" : "Choose Pattern"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Wall Color</h3>
          <p className="text-sm text-muted-foreground">Keep the walls clean and easy to swap.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {OFFICE_WALL_COLOR_PRESETS.map((preset) => (
            <Card key={preset.id} className="flex flex-col">
              <div className="h-20 border-b" style={{ backgroundColor: preset.color }} />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{preset.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </CardHeader>
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={draftWallColorId === preset.id ? "secondary" : "outline"}
                  disabled={isSavingDecor}
                  onClick={() => setDraftWallColorId(preset.id)}
                >
                  {draftWallColorId === preset.id ? "Selected" : "Choose Color"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Void Background</h3>
          <p className="text-sm text-muted-foreground">
            Set the 3D space backdrop. Each preset includes both a light-mode and dark-mode tone.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {OFFICE_BACKGROUND_PRESETS.map((preset) => (
            <Card key={preset.id} className="flex flex-col">
              <div className="h-20 border-b" style={{ backgroundImage: preset.swatch }} />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{preset.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </CardHeader>
              <CardContent className="pt-0 pb-4 text-xs text-muted-foreground">
                <p>Light: {preset.lightColor}</p>
                <p>Dark: {preset.darkColor}</p>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  className="w-full"
                  variant={draftBackgroundId === preset.id ? "secondary" : "outline"}
                  disabled={isSavingDecor}
                  onClick={() => setDraftBackgroundId(preset.id)}
                >
                  {draftBackgroundId === preset.id ? "Selected" : "Choose Background"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">Wall Paintings</h3>
          <p className="text-sm text-muted-foreground">
            Pick one of the bundled paintings and assign it to a fixed wall slot.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {wallArtSlots.map((slot) => {
            const assignedObject = wallArtBySlotId.get(slot.id);
            const assignedPresetId =
              typeof assignedObject?.metadata?.paintingPresetId === "string"
                ? (assignedObject.metadata.paintingPresetId as OfficePaintingPresetId)
                : null;
            const assignedPreset = assignedPresetId ? getPaintingPreset(assignedPresetId) : null;

            return (
              <Card key={slot.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{slot.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {assignedPreset ? `Current: ${assignedPreset.label}` : "Current: empty"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {OFFICE_PAINTING_PRESETS.map((preset) => (
                      <button
                        key={`${slot.id}-${preset.id}`}
                        type="button"
                        className="rounded-lg border text-left transition hover:border-primary/60 hover:bg-muted/40"
                        disabled={isSavingDecor}
                        onClick={() => void handlePlacePainting(slot.id, preset.id)}
                      >
                        <div
                          className="h-20 rounded-t-lg border-b"
                          style={{
                            background: `linear-gradient(135deg, ${preset.colors[0]} 0%, ${preset.colors[1]} 55%, ${preset.colors[2]} 100%)`,
                          }}
                        />
                        <div className="p-3">
                          <p className="text-sm font-medium">{preset.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    variant="outline"
                    disabled={!assignedPreset || isSavingDecor}
                    onClick={() => void handleClearPainting(slot.id)}
                  >
                    Clear Slot
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[85vw] max-w-[85vw] h-[85vh] sm:max-w-[85vw] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Decoration</DialogTitle>
          <DialogDescription className="sr-only">
            Configure office decoration and import custom meshes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r bg-background p-4 flex flex-col gap-2 shrink-0">
            <Button
              variant={activeTab === "catalog" ? "secondary" : "ghost"}
              className={cn("justify-start", activeTab === "catalog" && "bg-muted")}
              onClick={() => setActiveTab("catalog")}
            >
              <Store className="w-4 h-4 mr-2" />
              Furniture
            </Button>
            <Button
              variant={activeTab === "decor" ? "secondary" : "ghost"}
              className={cn("justify-start", activeTab === "decor" && "bg-muted")}
              onClick={() => setActiveTab("decor")}
            >
              <Palette className="w-4 h-4 mr-2" />
              Decor
            </Button>
            <Button
              variant={activeTab === "custom" ? "secondary" : "ghost"}
              className={cn("justify-start", activeTab === "custom" && "bg-muted")}
              onClick={() => setActiveTab("custom")}
            >
              <Box className="w-4 h-4 mr-2" />
              Custom Library
            </Button>
            <Button
              variant={activeTab === "import" ? "secondary" : "ghost"}
              className={cn("justify-start", activeTab === "import" && "bg-muted")}
              onClick={() => setActiveTab("import")}
            >
              <CloudDownload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>

          {/* Main Content Area */}
          <ScrollArea className="flex-1 bg-background">
            <div className="p-6">
              {activeTab === "catalog" && renderCatalog()}
              {activeTab === "decor" && renderDecor()}
              {activeTab === "custom" && renderCustomLibrary()}
              {activeTab === "import" && renderImport()}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
