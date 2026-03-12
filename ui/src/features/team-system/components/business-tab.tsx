"use client";

/**
 * BUSINESS TAB
 * ============
 * Business command deck: capability flow composer, skill library, readiness checklist,
 * tracking context, and resource viewer.
 *
 * KEY CONCEPTS:
 * - Composes BusinessFlowComposer + BusinessSkillLibrary + BusinessReadinessPanel.
 * - Delegates all persistence to the parent via onSave callback.
 *
 * USAGE:
 * - Rendered inside TeamPanel as the "business" TabsContent.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectResourceModel } from "@/lib/openclaw-types";
import { BusinessFlowComposer } from "./business-flow/business-flow-composer";
import { BusinessReadinessPanel } from "./business-flow/business-readiness-panel";
import { BusinessSkillLibrary, type BusinessSlotKey } from "./business-flow/business-skill-library";
import { ResourcesSection } from "./business-flow/resources-section";
import {
  TeamSkillEquipMatrix,
  type TeamSkillEquipRow,
} from "./business-flow/team-skill-equip-matrix";
import type { BusinessBuilderDraft } from "@/lib/business-builder";
import type { BusinessReadinessIssue } from "@/lib/business-builder";

interface BusinessTabProps {
  builderDraft: BusinessBuilderDraft;
  selectedBusinessSlot: BusinessSlotKey;
  setSelectedBusinessSlot: (slot: BusinessSlotKey) => void;
  onToggleCapabilitySkill: (slot: BusinessSlotKey, skillId: string) => void;
  trackingContext: string;
  setTrackingContext: (value: string) => void;
  onSave: () => Promise<void>;
  saveState: { pending: boolean; error?: string; ok?: string };
  readinessIssues: BusinessReadinessIssue[];
  fallbackReady: boolean;
  activeExperimentCount: number;
  onViewProjects: () => void;
  resources: ProjectResourceModel[];
  hasBusinessConfig: boolean;
  teamSkillRows: TeamSkillEquipRow[];
}

export function BusinessTab({
  builderDraft,
  selectedBusinessSlot,
  setSelectedBusinessSlot,
  onToggleCapabilitySkill,
  trackingContext,
  setTrackingContext,
  onSave,
  saveState,
  readinessIssues,
  fallbackReady,
  activeExperimentCount,
  onViewProjects,
  resources,
  hasBusinessConfig,
  teamSkillRows,
}: BusinessTabProps): JSX.Element {
  return (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Business Command Deck</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
              <BusinessSkillLibrary
                selectedSlot={selectedBusinessSlot}
                onSelectSlot={setSelectedBusinessSlot}
                onToggleSkill={onToggleCapabilitySkill}
                currentSkills={builderDraft.capabilitySkills}
              />
              <BusinessFlowComposer
                selectedSlot={selectedBusinessSlot}
                capabilitySkills={builderDraft.capabilitySkills}
                onSelectSlot={setSelectedBusinessSlot}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void onSave()} disabled={saveState.pending}>
                {saveState.pending ? "Saving..." : "Save Business Config"}
              </Button>
            </div>
            {saveState.error ? <p className="text-sm text-destructive">{saveState.error}</p> : null}
            {saveState.ok ? <p className="text-sm text-emerald-500">{saveState.ok}</p> : null}
            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tracking &amp; Metrics Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={trackingContext}
                  onChange={(e) => setTrackingContext(e.target.value)}
                  placeholder="Describe how this business tracks success. This context is used by PM/executor prompts."
                  className="min-h-28"
                />
                <p className="text-xs text-muted-foreground">
                  Use `shellcorp team business context set --team-id ... --text ...` to update this
                  from CLI.
                </p>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <BusinessReadinessPanel issues={readinessIssues} fallbackReady={fallbackReady} />

        <TeamSkillEquipMatrix rows={teamSkillRows} />

        <Card>
          <CardContent className="flex items-center justify-between gap-3 pt-4 text-sm">
            <span>
              Active Experiments: <strong>{activeExperimentCount}</strong> running
            </span>
            <Button variant="outline" size="sm" onClick={onViewProjects}>
              View in Projects
            </Button>
          </CardContent>
        </Card>

        <ResourcesSection resources={resources} />

        {!hasBusinessConfig ? (
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              Configure capability slots in the flow and save to initialize business orchestration.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </ScrollArea>
  );
}
