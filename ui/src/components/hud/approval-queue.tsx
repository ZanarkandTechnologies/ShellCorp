"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  Terminal,
  Send,
  Rocket,
  Trash2,
  FileEdit,
  Settings,
  Clock,
  Loader2,
} from "lucide-react";

import { stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { PendingApprovalModel, ApprovalActionType, ApprovalRiskLevel } from "@/lib/openclaw-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

type ApprovalQueueProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

const ACTION_TYPE_META: Record<ApprovalActionType, { icon: typeof Terminal; label: string }> = {
  tool_call: { icon: Terminal, label: "Tool Call" },
  external_message: { icon: Send, label: "External Message" },
  deploy: { icon: Rocket, label: "Deploy" },
  delete: { icon: Trash2, label: "Delete" },
  write: { icon: FileEdit, label: "Write" },
  config_change: { icon: Settings, label: "Config Change" },
};

const RISK_COLORS: Record<ApprovalRiskLevel, string> = {
  low: "bg-green-500/20 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ApprovalCard({
  approval,
  onResolve,
  resolving,
}: {
  approval: PendingApprovalModel;
  onResolve: (id: string, decision: "approved" | "rejected") => void;
  resolving: string | null;
}) {
  const meta = ACTION_TYPE_META[approval.actionType] ?? ACTION_TYPE_META.tool_call;
  const ActionIcon = meta.icon;
  const isResolving = resolving === approval.id;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2.5 transition-all hover:border-foreground/20">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <ActionIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{meta.label}</p>
            <p className="text-xs text-muted-foreground truncate">{approval.agentId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${RISK_COLORS[approval.riskLevel]}`}>
            {approval.riskLevel}
          </Badge>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo(approval.createdAt)}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed">{approval.description}</p>

      {/* Context (collapsible-style, shown if present) */}
      {approval.context && (
        <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground leading-relaxed">
          {approval.context}
        </div>
      )}

      {/* Tool name if present */}
      {approval.toolName && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Terminal className="h-3 w-3" />
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{approval.toolName}</code>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-0.5">
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
          onClick={() => onResolve(approval.id, "approved")}
          disabled={isResolving}
        >
          {isResolving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Check className="mr-1.5 h-3 w-3" />}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 flex-1 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => onResolve(approval.id, "rejected")}
          disabled={isResolving}
        >
          {isResolving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <X className="mr-1.5 h-3 w-3" />}
          Reject
        </Button>
      </div>
    </div>
  );
}

export function ApprovalQueue({ isOpen, onOpenChange }: ApprovalQueueProps) {
  const adapter = useMemo(() => new OpenClawAdapter("", stateBase), []);
  const [approvals, setApprovals] = useState<PendingApprovalModel[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await adapter.getPendingApprovals();
      setApprovals(result);
    } catch {
      // Silently fail — approvals are non-critical
    }
  }, [adapter]);

  const handleResolve = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      setResolving(id);
      try {
        const result = await adapter.resolveApproval(id, decision);
        if (result.ok) {
          setApprovals((current) => current.filter((a) => a.id !== id));
        }
      } finally {
        setResolving(null);
      }
    },
    [adapter],
  );

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    void load();
    timerRef.current = setInterval(() => void load(), 10_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, load]);

  // Group by agent
  const grouped = useMemo(() => {
    const map = new Map<string, PendingApprovalModel[]>();
    for (const approval of approvals) {
      const existing = map.get(approval.agentId) ?? [];
      existing.push(approval);
      map.set(approval.agentId, existing);
    }
    return map;
  }, [approvals]);

  const criticalCount = approvals.filter((a) => a.riskLevel === "critical" || a.riskLevel === "high").length;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[460px] max-w-[95vw] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <ShieldAlert className="h-5 w-5 text-red-400" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-green-400" />
            )}
            Action Approvals
            {approvals.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {approvals.length}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Review and approve agent actions before execution. High-risk actions require operator sign-off.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-green-400/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">All clear</p>
              <p className="text-xs text-muted-foreground mt-1">No pending actions require your approval.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()].map(([agentId, agentApprovals]) => (
                <div key={agentId}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {agentId}
                    </h3>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {agentApprovals.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {agentApprovals.map((approval) => (
                      <ApprovalCard
                        key={approval.id}
                        approval={approval}
                        onResolve={handleResolve}
                        resolving={resolving}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
