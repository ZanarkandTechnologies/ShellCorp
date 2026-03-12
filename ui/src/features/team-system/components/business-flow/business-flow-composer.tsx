"use client";

/**
 * BUSINESS FLOW COMPOSER
 * ======================
 * React Flow-based capability orchestration canvas for business teams.
 *
 * KEY CONCEPTS:
 * - Slot nodes represent persisted `measure/execute/distribute` skill bindings.
 * - Edges are visual-only process wiring and do not change persistence directly.
 *
 * USAGE:
 * - Render inside Team Panel Business tab with external slot selection state.
 *
 * MEMORY REFERENCES:
 * - MEM-0131
 */
import { memo, type MouseEvent, useCallback, useMemo } from "react";
import { Handle, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Canvas } from "@/components/ai-elements/canvas";
import { Controls } from "@/components/ai-elements/controls";
import { Panel } from "@/components/ai-elements/panel";
import type { BusinessSlotKey } from "./business-skill-library";

interface BusinessFlowComposerProps {
  selectedSlot: BusinessSlotKey;
  capabilitySkills: Record<BusinessSlotKey, string>;
  onSelectSlot: (slot: BusinessSlotKey) => void;
}

const SLOT_NODE_IDS: Record<BusinessSlotKey, string> = {
  measure: "measure",
  execute: "execute",
  distribute: "distribute",
};

interface SkillNodeData {
  slot: BusinessSlotKey;
  title: string;
  active: boolean;
  skillsText: string;
}

interface CoreNodeData {
  planLabel: string;
  execute: string;
  measure: string;
  distribute: string;
}

const SLOT_THEME: Record<BusinessSlotKey, string> = {
  measure: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  execute: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  distribute: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

const SkillNode = memo(function SkillNode({
  data,
}: NodeProps<Node<SkillNodeData>["data"]>): React.JSX.Element {
  const slot = data.slot;
  return (
    <div
      className={`min-w-[250px] rounded-xl border bg-card/95 p-3 shadow-md transition-all ${
        data.active ? "border-primary shadow-lg ring-1 ring-primary/40" : "border-border"
      }`}
    >
      <Handle type="source" position={Position.Right} className="h-2 w-2 !border-0 !bg-primary" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Capability Skill</p>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wide ${SLOT_THEME[slot]}`}
        >
          {slot}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold">{data.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {data.skillsText || "No active skills selected yet."}
      </p>
    </div>
  );
});

const CoreNode = memo(function CoreNode({
  data,
}: NodeProps<Node<CoreNodeData>["data"]>): React.JSX.Element {
  return (
    <div className="min-w-[340px] rounded-xl border border-primary/50 bg-card/95 p-4 shadow-lg ring-1 ring-primary/30">
      <Handle
        id="measure-in"
        type="target"
        position={Position.Left}
        style={{ top: "33%" }}
        className="h-2.5 w-2.5 !border-0 !bg-sky-400"
      />
      <Handle
        id="execute-in"
        type="target"
        position={Position.Left}
        style={{ top: "50%" }}
        className="h-2.5 w-2.5 !border-0 !bg-amber-400"
      />
      <Handle
        id="distribute-in"
        type="target"
        position={Position.Left}
        style={{ top: "67%" }}
        className="h-2.5 w-2.5 !border-0 !bg-emerald-400"
      />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-primary">Business Core</p>
        <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
          n8n style
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <p>
          <span className="text-muted-foreground">Plan:</span>{" "}
          <span className="font-medium">{data.planLabel}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Execute:</span>{" "}
          <span className="font-medium">{data.execute}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Measure:</span>{" "}
          <span className="font-medium">{data.measure}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Distribute:</span>{" "}
          <span className="font-medium">{data.distribute}</span>
        </p>
      </div>
    </div>
  );
});

function createNodes(
  capabilitySkills: Record<BusinessSlotKey, string>,
  selectedSlot: BusinessSlotKey,
): Node[] {
  return [
    {
      id: SLOT_NODE_IDS.measure,
      type: "skillNode",
      position: { x: 60, y: 70 },
      data: {
        slot: "measure",
        title: "Measure Node",
        active: selectedSlot === "measure",
        skillsText: capabilitySkills.measure || "not-set",
      },
    },
    {
      id: SLOT_NODE_IDS.execute,
      type: "skillNode",
      position: { x: 60, y: 220 },
      data: {
        slot: "execute",
        title: "Execute Node",
        active: selectedSlot === "execute",
        skillsText: capabilitySkills.execute || "not-set",
      },
    },
    {
      id: SLOT_NODE_IDS.distribute,
      type: "skillNode",
      position: { x: 60, y: 370 },
      data: {
        slot: "distribute",
        title: "Distribute Node",
        active: selectedSlot === "distribute",
        skillsText: capabilitySkills.distribute || "not-set",
      },
    },
    {
      id: "business-core",
      type: "coreNode",
      position: { x: 420, y: 190 },
      data: {
        planLabel: "PM Agent",
        execute: capabilitySkills.execute || "not-set",
        measure: capabilitySkills.measure || "not-set",
        distribute: capabilitySkills.distribute || "not-set",
      },
    },
  ];
}

function createEdges(): Edge[] {
  return [
    {
      id: "edge-measure-core",
      source: SLOT_NODE_IDS.measure,
      target: "business-core",
      targetHandle: "measure-in",
      animated: true,
      label: "measure",
      style: { stroke: "var(--chart-1)" },
    },
    {
      id: "edge-execute-core",
      source: SLOT_NODE_IDS.execute,
      target: "business-core",
      targetHandle: "execute-in",
      animated: true,
      label: "execute",
      style: { stroke: "var(--chart-2)" },
    },
    {
      id: "edge-distribute-core",
      source: SLOT_NODE_IDS.distribute,
      target: "business-core",
      targetHandle: "distribute-in",
      animated: true,
      label: "distribute",
      style: { stroke: "var(--chart-3)" },
    },
  ];
}

export function BusinessFlowComposer({
  selectedSlot,
  capabilitySkills,
  onSelectSlot,
}: BusinessFlowComposerProps): React.JSX.Element {
  const nodes = useMemo(
    () => createNodes(capabilitySkills, selectedSlot),
    [capabilitySkills, selectedSlot],
  );
  const edges = useMemo(() => createEdges(), []);
  const nodeTypes = useMemo(
    () => ({
      skillNode: SkillNode,
      coreNode: CoreNode,
    }),
    [],
  );

  const onNodeClick = useCallback(
    (_event: MouseEvent, node: Node) => {
      if (node.id === SLOT_NODE_IDS.measure) onSelectSlot("measure");
      if (node.id === SLOT_NODE_IDS.execute) onSelectSlot("execute");
      if (node.id === SLOT_NODE_IDS.distribute) onSelectSlot("distribute");
    },
    [onSelectSlot],
  );

  const capabilityLabel = `${selectedSlot} -> ${capabilitySkills[selectedSlot] || "not-set"}`;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Business Operating Flow</CardTitle>
      </CardHeader>
      <CardContent className="h-[460px] min-h-0 rounded-md border p-0">
        <Canvas
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitViewOptions={{ padding: 0.2 }}
        >
          <Controls />
          <Panel position="top-left" className="text-xs">
            Active slot: {capabilityLabel}
          </Panel>
        </Canvas>
      </CardContent>
    </Card>
  );
}
