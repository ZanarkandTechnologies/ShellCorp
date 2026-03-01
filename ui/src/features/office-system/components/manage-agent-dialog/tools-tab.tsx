"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Doc } from "@/convex/_generated/dataModel";

interface ToolsTabProps {
    allTools: Doc<"toolConfigs">[] | undefined;
    selectedTools: Id<"toolConfigs">[];
    toggleTool: (toolId: Id<"toolConfigs">) => void;
    expandedToolsets: Set<string>;
    toggleToolset: (toolsetId: string) => void;
    selectAllToolsInToolset: (toolsetId: string, toolIds: Id<"toolConfigs">[]) => void;
    toolsByToolset: Map<string, Doc<"toolConfigs">[]>;
}

export function ToolsTab({
    allTools,
    selectedTools,
    toggleTool,
    expandedToolsets,
    toggleToolset,
    selectAllToolsInToolset,
    toolsByToolset,
}: ToolsTabProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Available Tools ({selectedTools.length} selected)
                </Label>
                <p className="text-sm text-muted-foreground">
                    Select tools this agent can use. Tools enable specific capabilities like code execution, web search, etc.
                </p>

                {allTools && allTools.length > 0 ? (
                    <div className="space-y-3 mt-4">
                        {/* Group tools by toolset */}
                        {Array.from(toolsByToolset.entries()).map(([toolsetId, toolsetTools]) => {
                            const isExpanded = expandedToolsets.has(toolsetId);
                            const selectedCount = toolsetTools.filter(t => selectedTools.includes(t._id)).length;
                            const allSelected = toolsetTools.every(t => selectedTools.includes(t._id));
                            const toolsetToolIds = toolsetTools.map(t => t._id);

                            return (
                                <div key={toolsetId} className="border rounded-lg">
                                    {/* Toolset Header */}
                                    <div
                                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => toggleToolset(toolsetId)}
                                    >
                                        <div className="flex items-center gap-2 flex-1">
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            )}
                                            <h4 className="text-sm font-semibold capitalize">
                                                {toolsetId.replace(/_/g, " ")}
                                            </h4>
                                            <Badge variant="secondary" className="text-xs">
                                                {selectedCount}/{toolsetTools.length}
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                selectAllToolsInToolset(toolsetId, toolsetToolIds);
                                            }}
                                        >
                                            {allSelected ? "Deselect All" : "Select All"}
                                        </Button>
                                    </div>

                                    {/* Toolset Tools (shown when expanded) */}
                                    {isExpanded && (
                                        <div className="p-3 pt-0 space-y-2">
                                            <div className="grid grid-cols-2 gap-2">
                                                {toolsetTools.map((tool) => {
                                                    const isSelected = selectedTools.includes(tool._id);
                                                    return (
                                                        <div
                                                            key={tool._id}
                                                            onClick={() => toggleTool(tool._id)}
                                                            className={cn(
                                                                "p-3 border rounded-md cursor-pointer transition-colors",
                                                                isSelected
                                                                    ? "border-primary bg-primary/10"
                                                                    : "border-border hover:border-primary/50"
                                                            )}
                                                        >
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-medium text-sm">{tool.name}</span>
                                                                        {isSelected && (
                                                                            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                                                        )}
                                                                    </div>
                                                                    {tool.description && (
                                                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                                            {tool.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                        No tools available. Create tools in the tool configs.
                    </p>
                )}
            </div>
        </div>
    );
}
