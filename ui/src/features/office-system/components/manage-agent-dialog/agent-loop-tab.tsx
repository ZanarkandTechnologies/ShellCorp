"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Loader2, Pause, Play, Square, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatUIMessage } from "@/convex/chat_system/chats";

interface AgentLoopTabProps {
    employeeId: Id<"employees">;
    workflowStatus: {
        status: string;
        iterationCount?: number;
        lastIterationAt?: number;
        lastAction?: string;
        intervalMinutes?: number;
        currentPlan?: string;
        lastReward?: number;
        error?: string;
    } | null | undefined;
    workflowError: string | null;
    isWorkflowLoading: boolean;
    isRunning: boolean;
    isPaused: boolean;
    isStopped: boolean;
    loopThread: { threadId: string; title?: string } | null | undefined;
    loopMessages: (ChatUIMessage & { key: string })[];
    messagesStatus: string;
    handleStartLoop: () => void;
    handlePauseLoop: () => void;
    handleResumeLoop: () => void;
    handleStopLoop: () => void;
    getStatusBadgeVariant: (status: string | undefined) => "default" | "secondary" | "outline" | "destructive";
}

export function AgentLoopTab({
    workflowStatus,
    workflowError,
    isWorkflowLoading,
    isRunning,
    isPaused,
    isStopped,
    loopThread,
    loopMessages,
    messagesStatus,
    handleStartLoop,
    handlePauseLoop,
    handleResumeLoop,
    handleStopLoop,
    getStatusBadgeVariant,
}: AgentLoopTabProps) {
    return (
        <div className="space-y-4">
            {/* Agent Loop Controls */}
            <div className="p-4 bg-muted/30 rounded-xl border space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <RefreshCw className={cn("w-4 h-4", isRunning && "animate-spin")} />
                            Autonomous Agent Loop
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Durable workflow that runs every 30 minutes. Supports pause/resume.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        {workflowStatus?.status && (
                            <Badge variant={getStatusBadgeVariant(workflowStatus.status)}>
                                {workflowStatus.status}
                            </Badge>
                        )}

                        {/* Start Button */}
                        {isStopped && (
                            <Button
                                onClick={handleStartLoop}
                                disabled={isWorkflowLoading}
                                size="sm"
                                className="gap-2"
                            >
                                {isWorkflowLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                Start
                            </Button>
                        )}

                        {/* Pause Button */}
                        {isRunning && (
                            <Button
                                onClick={handlePauseLoop}
                                disabled={isWorkflowLoading}
                                size="sm"
                                variant="secondary"
                                className="gap-2"
                            >
                                {isWorkflowLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Pause className="w-4 h-4" />
                                )}
                                Pause
                            </Button>
                        )}

                        {/* Resume Button */}
                        {isPaused && (
                            <Button
                                onClick={handleResumeLoop}
                                disabled={isWorkflowLoading}
                                size="sm"
                                className="gap-2"
                            >
                                {isWorkflowLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                Resume
                            </Button>
                        )}

                        {/* Stop Button */}
                        {(isRunning || isPaused) && (
                            <Button
                                onClick={handleStopLoop}
                                disabled={isWorkflowLoading}
                                size="sm"
                                variant="destructive"
                                className="gap-2"
                            >
                                {isWorkflowLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                Stop
                            </Button>
                        )}
                    </div>
                </div>

                {/* Error Display */}
                {workflowError && (
                    <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                        <span className="font-medium">Error:</span>
                        <span className="ml-2">{workflowError}</span>
                    </div>
                )}

                {/* Workflow Status Display */}
                {workflowStatus?.error && (
                    <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                        <span className="font-medium">Workflow Error:</span>
                        <span className="ml-2">{workflowStatus.error}</span>
                    </div>
                )}

                {/* Stats Row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {workflowStatus?.iterationCount !== undefined && workflowStatus.iterationCount > 0 && (
                        <span>Iterations: <strong>{workflowStatus.iterationCount}</strong></span>
                    )}
                    {workflowStatus?.lastIterationAt && (
                        <span>Last run: {new Date(workflowStatus.lastIterationAt).toLocaleString()}</span>
                    )}
                    {workflowStatus?.lastAction && (
                        <span>Action: <code className="bg-black/10 px-1 rounded">{workflowStatus.lastAction}</code></span>
                    )}
                    {workflowStatus?.intervalMinutes && (
                        <span>Interval: {workflowStatus.intervalMinutes}min</span>
                    )}
                </div>
            </div>

            {/* Current Strategy Callout */}
            {workflowStatus?.currentPlan && (
                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
                            <Target className="w-3 h-3" />
                            Current Strategic Plan
                        </h4>
                        {workflowStatus.lastReward !== undefined && (
                            <Badge variant="outline" className="text-[10px] h-5 bg-background">
                                Reward: {workflowStatus.lastReward > 0 ? "+" : ""}{workflowStatus.lastReward}
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm font-medium italic">
                        "{workflowStatus.currentPlan}"
                    </p>
                </div>
            )}

            {/* Iteration Log */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Iteration Log
                    </Label>
                    {messagesStatus === "LoadingFirstPage" && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    View what the agent decides to do at each iteration
                </p>

                {!loopThread?.threadId ? (
                    <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg bg-muted/30">
                        <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No loop thread yet. Start the agent loop to begin logging iterations.</p>
                    </div>
                ) : loopMessages && loopMessages.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg bg-muted/30">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No iterations yet. The agent will log its decisions here.</p>
                    </div>
                ) : (
                    <ScrollArea className="h-[400px] border rounded-lg p-4 bg-background">
                        <div className="space-y-4">
                            {loopMessages?.map((message, idx: number) => {
                                const isUser = message.role === "user";
                                const parts = message.parts || [];
                                const textParts = parts.filter((p) => p.type === "text");
                                const toolParts = parts.filter((p) => p.type.startsWith("tool-"));

                                return (
                                    <div
                                        key={message.key || idx}
                                        className={cn(
                                            "p-3 rounded-lg border",
                                            isUser
                                                ? "bg-primary/5 border-primary/20"
                                                : "bg-muted/50 border-border"
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant={isUser ? "default" : "secondary"} className="text-xs">
                                                    {isUser ? "System" : "Agent"}
                                                </Badge>
                                                {message.createdAt && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(message.createdAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Text Content */}
                                        {textParts.length > 0 && (
                                            <div className="text-sm whitespace-pre-wrap mb-2">
                                                {textParts.map((p, pIdx: number) => (
                                                    <div key={pIdx}>{p.text}</div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tool Calls */}
                                        {toolParts.length > 0 && (
                                            <div className="space-y-2 mt-2 pt-2 border-t">
                                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                                    Tool Calls:
                                                </div>
                                                {toolParts.map((part, cIdx: number) => {
                                                    const toolName = part.type.replace(/^tool-/, "");
                                                    const toolPart = part as ChatUIMessage["parts"][number] & { type: `tool-${string}` };
                                                    return (
                                                        <div
                                                            key={cIdx}
                                                            className="text-xs bg-background p-2 rounded border"
                                                        >
                                                            <div className="font-mono font-medium">
                                                                {toolName}
                                                            </div>
                                                            {"args" in toolPart && toolPart.args && (
                                                                <div className="text-muted-foreground mt-1 font-mono text-[10px]">
                                                                    {JSON.stringify(toolPart.args, null, 2)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    );
}
