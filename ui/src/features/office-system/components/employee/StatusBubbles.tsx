"use client";

import { memo } from "react";
import { Html } from "@react-three/drei";

import type { AgentState } from "@/lib/openclaw-types";
import StatusIndicator, { type StatusType } from "@/features/nav-system/components/status-indicator";

/**
 * EMPLOYEE STATUS BUBBLES
 * =======================
 * Renders the floating status indicator, hover label, and debug decision badge.
 *
 * KEY CONCEPTS:
 * - Keep R3F HTML overlays isolated from the avatar mesh tree
 * - Reuse the existing heartbeat bubble renderer from StatusIndicator
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 */

type StatusBubble = { label: string; weight?: number };

type EmployeeStatusBubblesProps = {
  currentStatus: StatusType;
  statusMessage?: string;
  effectiveNotificationCount: number;
  heartbeatState?: AgentState;
  heartbeatBubbles: StatusBubble[];
  isHovered: boolean;
  isHighlighted: boolean;
  name: string;
  jobTitle?: string;
  team?: string;
  totalHeight: number;
  debugMode: boolean;
  debugDeskDecision: string;
};

export const EmployeeStatusBubbles = memo(function EmployeeStatusBubbles({
  currentStatus,
  statusMessage,
  effectiveNotificationCount,
  heartbeatState,
  heartbeatBubbles,
  isHovered,
  isHighlighted,
  name,
  jobTitle,
  team,
  totalHeight,
  debugMode,
  debugDeskDecision,
}: EmployeeStatusBubblesProps) {
  return (
    <>
      <StatusIndicator
        status={currentStatus}
        message={statusMessage}
        visible={currentStatus !== "none"}
        notificationCount={effectiveNotificationCount}
        mode={
          heartbeatState && heartbeatState !== "idle" && effectiveNotificationCount === 0
            ? "heartbeatBubbles"
            : "single"
        }
        bubbles={heartbeatBubbles}
      />

      {(isHovered || isHighlighted) && (
        <Html
          position={[0, totalHeight + 0.5, 0]}
          center
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-3 py-1.5 rounded-md text-xs font-medium shadow-lg whitespace-nowrap ${
                isHighlighted
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                  : "bg-foreground text-background"
              }`}
            >
              <div className="font-semibold">{name}</div>
              {jobTitle ? <div className="mt-0.5 text-[10px] opacity-80">{jobTitle}</div> : null}
              {team ? <div className="mt-0.5 text-[10px] opacity-60">{team}</div> : null}
            </div>
          </div>
        </Html>
      )}

      {debugMode && debugDeskDecision ? (
        <Html
          position={[0, totalHeight + 0.28, 0]}
          center
          zIndexRange={[100, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="rounded bg-black/75 px-2 py-1 text-[10px] text-white shadow">
            {debugDeskDecision}
          </div>
        </Html>
      ) : null}
    </>
  );
});
