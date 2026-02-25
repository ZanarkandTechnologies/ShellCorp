"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/app-store";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { TeamData } from "@/lib/types";
import { Users, Plus, Edit2, Trash2, MoreVertical, X, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamOptionsDialog } from "@/components/dialogs/team-options-dialog";

interface TeamManagerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

interface CreateTeamDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

function CreateTeamDialog({ isOpen, onOpenChange, onSuccess }: CreateTeamDialogProps) {
    const { company } = useOfficeDataContext();
    // Use selectors to prevent unnecessary re-renders
    const setPlacementMode = useAppStore(state => state.setPlacementMode);
    const placementMode = useAppStore(state => state.placementMode);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [services, setServices] = useState<string[]>([]);
    const [serviceInput, setServiceInput] = useState("");

    // Close dialog when placement mode becomes active
    useEffect(() => {
        if (placementMode.active) {
            onOpenChange(false);
        }
    }, [placementMode.active, onOpenChange]);

    const handleStartPlacement = () => {
        if (!company) return;

        // Close this modal and start placement mode
        onOpenChange(false);
        setPlacementMode({
            active: true,
            type: "team-cluster",
            data: {
                name,
                description,
                companyId: company._id,
                services: services.length > 0 ? services : undefined,
            },
        });
        // Reset form
        setName("");
        setDescription("");
        setServices([]);
        setServiceInput("");
        onSuccess();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Team</DialogTitle>
                    <DialogDescription>
                        Define your team and place their base in the office.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g., Engineering"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="col-span-3"
                            placeholder="Team description..."
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="services" className="text-right">
                            Services
                        </Label>
                        <div className="col-span-3 space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    id="services"
                                    value={serviceInput}
                                    onChange={(e) => setServiceInput(e.target.value)}
                                    placeholder="e.g., Web Development"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && serviceInput.trim()) {
                                            e.preventDefault();
                                            if (!services.includes(serviceInput.trim())) {
                                                setServices([...services, serviceInput.trim()]);
                                            }
                                            setServiceInput("");
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        if (serviceInput.trim() && !services.includes(serviceInput.trim())) {
                                            setServices([...services, serviceInput.trim()]);
                                            setServiceInput("");
                                        }
                                    }}
                                >
                                    Add
                                </Button>
                            </div>
                            {services.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {services.map((service, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                                        >
                                            {service}
                                            <button
                                                onClick={() => setServices(services.filter((_, i) => i !== idx))}
                                                className="hover:text-destructive"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                        onOpenChange(false);
                        setName("");
                        setDescription("");
                        setServices([]);
                        setServiceInput("");
                    }}>
                        Cancel
                    </Button>
                    <Button onClick={handleStartPlacement} disabled={!name || !company}>
                        Place Team Base
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface TeamCardProps {
    team: TeamData;
    onEdit: (team: TeamData) => void;
    onDelete: (teamId: string) => void;
}

function TeamCard({ team, onEdit, onDelete }: TeamCardProps) {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    return (
        <>
            <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-muted-foreground" />
                            <CardTitle>{team.name}</CardTitle>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsOptionsOpen(true)}>
                                    <MoreVertical className="mr-2 h-4 w-4" />
                                    Options
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEdit(team)}>
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => onDelete(team._id)}
                                    className="text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <CardDescription className="mb-4">{team.description}</CardDescription>
                    {team.services && team.services.length > 0 && (
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">Services</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {team.services.slice(0, 3).map((service, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                        {service}
                                    </Badge>
                                ))}
                                {team.services.length > 3 && (
                                    <Badge variant="secondary" className="text-xs">
                                        +{team.services.length - 3}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                            <span>Employees:</span>
                            <span className="font-medium">{team.employees?.length || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Desks:</span>
                            <span className="font-medium">{team.deskCount || 0}</span>
                        </div>
                        {team.clusterPosition && (
                            <div className="flex items-center justify-between">
                                <span>Position:</span>
                                <span className="font-mono text-xs">
                                    [{team.clusterPosition[0]?.toFixed(1)}, {team.clusterPosition[2]?.toFixed(1)}]
                                </span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            <TeamOptionsDialog
                team={team}
                isOpen={isOptionsOpen}
                onOpenChange={setIsOptionsOpen}
            />
        </>
    );
}

export function TeamManager({ isOpen, onOpenChange }: TeamManagerProps) {
    const { teams } = useOfficeDataContext();
    // Use selector to prevent unnecessary re-renders
    const placementMode = useAppStore(state => state.placementMode);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<TeamData | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [services, setServices] = useState<string[]>([]);
    const [serviceInput, setServiceInput] = useState("");

    const updateTeam = useMutation(api.office_system.teams.updateTeam);

    // Close all modals when placement mode becomes active
    useEffect(() => {
        if (placementMode.active) {
            onOpenChange(false);
            setIsCreateDialogOpen(false);
        }
    }, [placementMode.active, onOpenChange]);

    const handleDelete = async () => {
        // TODO: Implement deleteTeam mutation
        alert("Team deletion is not yet implemented.");
    };

    const handleEdit = (team: TeamData) => {
        setEditingTeam(team);
        setName(team.name);
        setDescription(team.description);
        setServices(team.services || []);
        setServiceInput("");
    };

    const handleUpdate = async () => {
        if (!editingTeam || !name.trim()) return;

        try {
            await updateTeam({
                teamId: editingTeam._id,
                name: name.trim(),
                description: description.trim() || undefined,
                services: services.length > 0 ? services : undefined,
            });
            resetForm();
        } catch (error) {
            console.error("Failed to update team:", error);
        }
    };

    const resetForm = () => {
        setName("");
        setDescription("");
        setServices([]);
        setServiceInput("");
        setEditingTeam(null);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] min-w-[90vw] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Manage Teams</DialogTitle>
                        <DialogDescription>
                            View and manage your office teams. Click &quot;Add Team&quot; to create a new team.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {/* Edit Form */}
                        {editingTeam && (
                            <div className="border rounded-lg p-4 space-y-4 bg-muted/50 mb-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Edit Team</h3>
                                    <Button variant="ghost" size="sm" onClick={resetForm}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <Label>Name *</Label>
                                        <Input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g., Engineering"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Team description..."
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Services</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={serviceInput}
                                                onChange={(e) => setServiceInput(e.target.value)}
                                                placeholder="e.g., Web Development"
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && serviceInput.trim()) {
                                                        e.preventDefault();
                                                        if (!services.includes(serviceInput.trim())) {
                                                            setServices([...services, serviceInput.trim()]);
                                                        }
                                                        setServiceInput("");
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    if (serviceInput.trim() && !services.includes(serviceInput.trim())) {
                                                        setServices([...services, serviceInput.trim()]);
                                                        setServiceInput("");
                                                    }
                                                }}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                        {services.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {services.map((service, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                                                    >
                                                        {service}
                                                        <button
                                                            onClick={() => setServices(services.filter((_, i) => i !== idx))}
                                                            className="hover:text-destructive"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleUpdate}
                                            disabled={!name.trim()}
                                        >
                                            Update Team
                                        </Button>
                                        <Button variant="outline" onClick={resetForm}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {teams.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Create your first team to get started.
                                </p>
                                <Button onClick={() => setIsCreateDialogOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Team
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-sm text-muted-foreground">
                                        {teams.length} {teams.length === 1 ? "team" : "teams"}
                                    </p>
                                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Team
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {teams.map((team) => (
                                        <TeamCard
                                            key={team._id}
                                            team={team}
                                            onEdit={handleEdit}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <CreateTeamDialog
                isOpen={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onSuccess={() => {
                    // Dialog will close and trigger placement mode
                }}
            />
        </>
    );
}
