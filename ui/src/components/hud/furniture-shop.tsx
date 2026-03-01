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

interface FurnitureShopProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FurnitureShop({ isOpen, onOpenChange }: FurnitureShopProps) {
    const { company } = useOfficeDataContext();
    const { startPlacement } = usePlacementSystem();

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

    const handleBuyAndPlace = (item: typeof items[0]) => {
        if (!company) return;

        // Close shop and tell the system to start placement
        onOpenChange(false);

        startPlacement(item.id, {
            companyId: company._id,
            itemName: item.name,
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

