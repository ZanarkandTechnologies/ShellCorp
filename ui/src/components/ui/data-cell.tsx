"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Citation {
    url: string;
    title?: string;
    snippet?: string;
    accessedAt: number;
}

export interface DataCellProps {
    value: string | number | boolean | null | undefined;
    confidence?: number; // 0-1 score
    citations?: Citation[];
    reasoning?: string;
    status?: "empty" | "researching" | "completed" | "failed";
    needsRefresh?: boolean;
    className?: string;
}

export function DataCell({
    value,
    confidence,
    citations,
    reasoning,
    status = "completed",
    needsRefresh,
    className,
}: DataCellProps) {
    // Format the display value
    const displayValue = value === null || value === undefined || value === ""
        ? "N/A"
        : String(value);

    // Determine confidence color
    const getConfidenceColor = (conf?: number) => {
        if (!conf) return "text-muted-foreground";
        if (conf >= 0.8) return "text-green-600 dark:text-green-400";
        if (conf >= 0.6) return "text-yellow-600 dark:text-yellow-400";
        return "text-orange-600 dark:text-orange-400";
    };

    // Determine status indicator
    const getStatusIndicator = () => {
        if (status === "researching") return "🔄";
        if (status === "failed") return "❌";
        if (needsRefresh) return "⚠️";
        return null;
    };

    const hasMetadata = confidence !== undefined || (citations && citations.length > 0) || reasoning;

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-help">
                        <span className={cn(
                            "text-sm truncate max-w-[200px]",
                            getConfidenceColor(confidence)
                        )}>
                            {displayValue}
                        </span>
                        {getStatusIndicator() && (
                            <span className="text-xs">{getStatusIndicator()}</span>
                        )}
                        {hasMetadata && (
                            <Info className="h-3 w-3 text-muted-foreground" />
                        )}
                    </div>
                </HoverCardTrigger>
                {hasMetadata && (
                    <HoverCardContent className="w-80">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold">Data Quality</span>
                                {confidence !== undefined && (
                                    <Badge variant="outline" className={getConfidenceColor(confidence)}>
                                        {Math.round(confidence * 100)}% confident
                                    </Badge>
                                )}
                            </div>

                            {reasoning && (
                                <>
                                    <Separator />
                                    <div>
                                        <span className="text-xs font-medium">Agent Reasoning:</span>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                                            {reasoning}
                                        </p>
                                    </div>
                                </>
                            )}

                            {citations && citations.length > 0 && (
                                <>
                                    <Separator />
                                    <div>
                                        <span className="text-xs font-medium">
                                            Sources ({citations.length}):
                                        </span>
                                        <div className="space-y-1 mt-1">
                                            {citations.slice(0, 2).map((citation, idx) => (
                                                <a
                                                    key={idx}
                                                    href={citation.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                                >
                                                    <ExternalLink className="h-2.5 w-2.5" />
                                                    <span className="truncate">
                                                        {citation.title || citation.url}
                                                    </span>
                                                </a>
                                            ))}
                                            {citations.length > 2 && (
                                                <span className="text-xs text-muted-foreground">
                                                    +{citations.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {(reasoning || (citations && citations.length > 2)) && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full mt-2">
                                            <FileText className="h-3 w-3 mr-2" />
                                            View Full Details
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh]">
                                        <DialogHeader>
                                            <DialogTitle>Data Point Details</DialogTitle>
                                            <DialogDescription>
                                                Value: {displayValue}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <ScrollArea className="h-[60vh]">
                                            <div className="space-y-4 p-4">
                                                {confidence !== undefined && (
                                                    <div>
                                                        <label className="text-sm font-medium">Confidence Score</label>
                                                        <div className="mt-2">
                                                            <Badge className={getConfidenceColor(confidence)}>
                                                                {Math.round(confidence * 100)}%
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )}

                                                {reasoning && (
                                                    <>
                                                        <Separator />
                                                        <div>
                                                            <label className="text-sm font-medium">Agent Reasoning</label>
                                                            <div className="mt-2 bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                                                                {reasoning}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                {citations && citations.length > 0 && (
                                                    <>
                                                        <Separator />
                                                        <div>
                                                            <label className="text-sm font-medium">
                                                                Citations ({citations.length})
                                                            </label>
                                                            <div className="mt-2 space-y-3">
                                                                {citations.map((citation, idx) => (
                                                                    <div key={idx} className="border rounded-md p-3 bg-accent/50">
                                                                        <a
                                                                            href={citation.url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline mb-1"
                                                                        >
                                                                            <ExternalLink className="h-3 w-3" />
                                                                            {citation.title || "Source"}
                                                                        </a>
                                                                        {citation.snippet && (
                                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                                {citation.snippet}
                                                                            </p>
                                                                        )}
                                                                        <p className="text-xs text-muted-foreground mt-2">
                                                                            Accessed: {new Date(citation.accessedAt).toLocaleString()}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground truncate mt-1">
                                                                            {citation.url}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </HoverCardContent>
                )}
            </HoverCard>
        </div>
    );
}


