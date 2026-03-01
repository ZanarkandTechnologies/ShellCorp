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
 * 4. Add corresponding mutation in convex/office_system/office_objects.ts if needed
 */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { gatewayBase, stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { MeshAssetModel } from "@/lib/openclaw-types";

interface FurnitureShopProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FurnitureShop({ isOpen, onOpenChange }: FurnitureShopProps) {
    const { company } = useOfficeDataContext();
    const { startPlacement } = usePlacementSystem();
    const adapterRef = useRef<OpenClawAdapter>(new OpenClawAdapter(gatewayBase, stateBase));
    const [meshAssets, setMeshAssets] = useState<MeshAssetModel[]>([]);
    const [meshAssetDir, setMeshAssetDir] = useState("");
    const [meshUrlInput, setMeshUrlInput] = useState("");
    const [meshLabelInput, setMeshLabelInput] = useState("");
    const [isDownloadingMesh, setIsDownloadingMesh] = useState(false);
    const [isSavingDir, setIsSavingDir] = useState(false);
    const [isLoadingAssets, setIsLoadingAssets] = useState(false);
    const [meshError, setMeshError] = useState<string | null>(null);

    // Shop inventory
    // TODO: Move to database once item system is more mature
    const items = [
        {
            id: "desk",
            name: "Office Desk",
            price: 500,
            description: "Standard employee desk",
            placementType: "hybrid" // Can be assigned to team OR placed at coordinates
        },
        // Future items:
        // { id: "plant", name: "Plant", price: 50, description: "Decorative plant", placementType: "coordinate" },
        // { id: "meeting-table", name: "Meeting Table", price: 1000, description: "6-person conference table", placementType: "coordinate" },
        // { id: "coffee-machine", name: "Coffee Machine", price: 800, description: "Keep your team caffeinated", placementType: "coordinate" },
    ];

    const hasMeshAssets = meshAssets.length > 0;

    const sortedMeshAssets = useMemo(
        () => [...meshAssets].sort((a, b) => b.addedAt - a.addedAt),
        [meshAssets],
    );

    const loadMeshAssets = async () => {
        setIsLoadingAssets(true);
        setMeshError(null);
        try {
            const adapter = adapterRef.current;
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

    const handleBuyAndPlace = (item: typeof items[0]) => {
        if (!company) return;

        // Close shop and tell the system to start placement
        onOpenChange(false);

        startPlacement(item.id, {
            companyId: company._id,
            itemName: item.name,
        });
    };

    const handleSaveMeshDir = async () => {
        const nextDir = meshAssetDir.trim();
        if (!nextDir) {
            setMeshError("Mesh asset folder path is required.");
            return;
        }
        setIsSavingDir(true);
        setMeshError(null);
        const result = await adapterRef.current.saveOfficeSettings({ meshAssetDir: nextDir });
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
        const result = await adapterRef.current.downloadMeshAsset({
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

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Furniture Shop</DialogTitle>
                    <DialogDescription>
                        Buy furniture and equipment for your office.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        {items.map((item) => (
                            <Card key={item.id}>
                                <CardHeader>
                                    <CardTitle className="text-lg">{item.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                                    <p className="font-bold">${item.price}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={() => handleBuyAndPlace(item)} className="w-full">
                                        Buy & Place
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    <div className="rounded-md border p-4 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-semibold">Custom Meshes (Meshy)</h3>
                                <p className="text-xs text-muted-foreground">
                                    Local files live under your OpenClaw mesh asset folder.
                                </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => void loadMeshAssets()} disabled={isLoadingAssets}>
                                {isLoadingAssets ? "Refreshing..." : "Refresh Catalog"}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mesh-asset-dir">Mesh asset folder</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="mesh-asset-dir"
                                    value={meshAssetDir}
                                    onChange={(event) => setMeshAssetDir(event.target.value)}
                                    placeholder="~/.openclaw/assets/meshes"
                                />
                                <Button onClick={() => void handleSaveMeshDir()} disabled={isSavingDir}>
                                    {isSavingDir ? "Saving..." : "Save Folder"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                You can manually copy `.glb`/`.gltf` files into this folder, then refresh catalog.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="mesh-url">Download mesh from URL</Label>
                            <Input
                                id="mesh-url"
                                value={meshUrlInput}
                                onChange={(event) => setMeshUrlInput(event.target.value)}
                                placeholder="https://example.com/model.glb"
                            />
                            <Input
                                value={meshLabelInput}
                                onChange={(event) => setMeshLabelInput(event.target.value)}
                                placeholder="Optional label (e.g., cyber-desk)"
                            />
                            <Button onClick={() => void handleDownloadMesh()} disabled={isDownloadingMesh}>
                                {isDownloadingMesh ? "Downloading..." : "Download to Mesh Folder"}
                            </Button>
                        </div>

                        {meshError ? (
                            <p className="text-sm text-destructive">{meshError}</p>
                        ) : null}

                        <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-1">
                            {hasMeshAssets ? (
                                sortedMeshAssets.map((asset) => (
                                    <Card key={asset.assetId}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">{asset.label}</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-1 text-xs text-muted-foreground">
                                            <p>{asset.fileName}</p>
                                            <p>{Math.max(1, Math.round(asset.fileSizeBytes / 1024))} KB</p>
                                            <p className="truncate">{asset.localPath}</p>
                                        </CardContent>
                                        <CardFooter>
                                            <Button className="w-full" onClick={() => startCustomMeshPlacement(asset)}>
                                                Place Mesh
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    No mesh assets found. Copy files into folder or download from URL.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

