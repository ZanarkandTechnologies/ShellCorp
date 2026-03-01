"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wrench, Plus, Trash2, Edit2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "@/convex/_generated/dataModel";

interface ToolManagerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ToolManager({ isOpen, onOpenChange }: ToolManagerProps) {
    const tools = useQuery(api.agents_system.tools.toolConfigs.listToolConfigs, {
        activeOnly: false,
    });
    const createTool = useMutation(api.agents_system.tools.toolConfigs.createTool);
    const updateTool = useMutation(api.agents_system.tools.toolConfigs.updateTool);
    const deleteTool = useMutation(api.agents_system.tools.toolConfigs.deleteTool);

    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<Id<"toolConfigs"> | null>(null);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [implementationPath, setImplementationPath] = useState("");

    const handleCreate = async () => {
        if (!name.trim()) return;

        try {
            await createTool({
                name: name.trim(),
                description: description.trim() || undefined,
                category: category.trim() || undefined,
                implementationPath: implementationPath.trim() || undefined,
            });
            resetForm();
        } catch (error) {
            console.error("Failed to create tool:", error);
        }
    };

    const handleUpdate = async (toolId: Id<"toolConfigs">) => {
        try {
            await updateTool({
                toolId,
                name: name.trim(),
                description: description.trim() || undefined,
                category: category.trim() || undefined,
                implementationPath: implementationPath.trim() || undefined,
            });
            resetForm();
        } catch (error) {
            console.error("Failed to update tool:", error);
        }
    };

    const handleDelete = async (toolId: Id<"toolConfigs">) => {
        if (!confirm("Are you sure you want to delete this tool?")) return;
        try {
            await deleteTool({ toolId });
        } catch (error) {
            console.error("Failed to delete tool:", error);
        }
    };

    const resetForm = () => {
        setName("");
        setDescription("");
        setCategory("");
        setImplementationPath("");
        setIsCreating(false);
        setEditingId(null);
    };

    const startEdit = (tool: Doc<"toolConfigs">) => {
        setName(tool.name);
        setDescription(tool.description || "");
        setCategory(tool.category || "");
        setImplementationPath(tool.implementationPath || "");
        setEditingId(tool._id);
        setIsCreating(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5" />
                        Manage Tools
                    </DialogTitle>
                    <DialogDescription>
                        Add and manage tools including MCP servers that agents can use
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                    {/* Create/Edit Form */}
                    {(isCreating || editingId) && (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/50 flex-shrink-0">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">
                                    {editingId ? "Edit Tool" : "Create New Tool"}
                                </h3>
                                <Button variant="ghost" size="sm" onClick={resetForm}>
                                    Cancel
                                </Button>
                            </div>
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label>Name *</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g., MCP Server, Python Executor"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What does this tool do?"
                                        className="min-h-[60px]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Input
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            placeholder="e.g., search, computation"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Implementation Path</Label>
                                        <Input
                                            value={implementationPath}
                                            onChange={(e) => setImplementationPath(e.target.value)}
                                            placeholder="Path to tool implementation"
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                                    disabled={!name.trim()}
                                >
                                    {editingId ? "Update Tool" : "Create Tool"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Tools List */}
                    <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                        <div className="flex items-center justify-between flex-shrink-0">
                            <Label className="text-sm font-semibold">Tools ({tools?.length || 0})</Label>
                            {!isCreating && !editingId && (
                                <Button size="sm" onClick={() => setIsCreating(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Tool
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
                            <ScrollArea className="h-full">
                                {tools && tools.length > 0 ? (
                                    <div className="p-4 space-y-2">
                                        {tools.map((tool) => (
                                            <div
                                                key={tool._id}
                                                className={cn(
                                                    "p-3 border rounded-md flex items-start justify-between",
                                                    !tool.isActive && "opacity-50"
                                                )}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{tool.name}</span>
                                                        {tool.isActive ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-gray-400" />
                                                        )}
                                                    </div>
                                                    {tool.description && (
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {tool.description}
                                                        </p>
                                                    )}
                                                    <div className="flex gap-2 mt-2">
                                                        {tool.category && (
                                                            <Badge variant="outline">{tool.category}</Badge>
                                                        )}
                                                        {tool.implementationPath && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                {tool.implementationPath}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => startEdit(tool)}
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(tool._id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No tools yet. Click &quot;Add Tool&quot; to create one.
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

