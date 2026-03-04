"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BusinessBuilderForm } from "@/components/hud/business-builder-form";
import { createBusinessBuilderDraft, type BusinessBuilderDraft, type BusinessTypeOption } from "@/lib/business-builder";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";

interface CreateTeamFormProps {
  onDone?: () => void;
}

function parseKpiList(input: string): string[] {
  return [...new Set(input.split(/[,\n]/g).map((entry) => entry.trim()).filter(Boolean))];
}

export function CreateTeamForm({ onDone }: CreateTeamFormProps): React.JSX.Element {
  const { refresh } = useOfficeDataContext();
  const adapter = useOpenClawAdapter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [kpisRaw, setKpisRaw] = useState("weekly_shipped_tickets, closed_vs_open_ticket_ratio");
  const [builderDraft, setBuilderDraft] = useState<BusinessBuilderDraft>(() => createBusinessBuilderDraft("none"));
  const [includeBuilder, setIncludeBuilder] = useState(true);
  const [includeGrowth, setIncludeGrowth] = useState(true);
  const [includePm, setIncludePm] = useState(true);
  const [registerOpenclawAgents, setRegisterOpenclawAgents] = useState(true);
  const [withCluster, setWithCluster] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = (): void => {
    setName("");
    setDescription("");
    setGoal("");
    setKpisRaw("weekly_shipped_tickets, closed_vs_open_ticket_ratio");
    setBuilderDraft(createBusinessBuilderDraft("none"));
    setIncludeBuilder(true);
    setIncludeGrowth(true);
    setIncludePm(true);
    setRegisterOpenclawAgents(true);
    setWithCluster(true);
    setError(null);
    setSuccess(null);
    setIsSubmitting(false);
  };

  const onSubmit = async (): Promise<void> => {
    const trimmedName = name.trim();
    const trimmedGoal = goal.trim();
    if (!trimmedName || !trimmedGoal) {
      setError("Name and goal are required.");
      return;
    }
    const autoRoles: Array<"builder" | "growth_marketer" | "pm"> = [];
    if (includeBuilder) autoRoles.push("builder");
    if (includeGrowth) autoRoles.push("growth_marketer");
    if (includePm) autoRoles.push("pm");
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    const businessType = builderDraft.businessType as BusinessTypeOption;
    const result = await adapter.createTeam({
      name: trimmedName,
      description: description.trim(),
      goal: trimmedGoal,
      kpis: parseKpiList(kpisRaw),
      autoRoles,
      registerOpenclawAgents,
      withCluster,
      ...(businessType !== "none"
        ? {
            businessType,
            capabilitySkills: {
              measure: builderDraft.capabilitySkills.measure.trim(),
              execute: builderDraft.capabilitySkills.execute.trim(),
              distribute: builderDraft.capabilitySkills.distribute.trim(),
            },
          }
        : {}),
    });
    if (!result.ok) {
      setError(result.error ?? "Failed to create team.");
      setIsSubmitting(false);
      return;
    }
    if (businessType !== "none" && result.projectId) {
      const saved = await adapter.saveBusinessBuilderConfig({
        projectId: result.projectId,
        businessType,
        capabilitySkills: builderDraft.capabilitySkills,
        resources: builderDraft.resources,
        source: "ui.create_team.builder",
      });
      if (!saved.ok) {
        setError(saved.error ?? "Business configuration save failed.");
        setIsSubmitting(false);
        return;
      }
    }
    await refresh();
    setSuccess("Team created.");
    setIsSubmitting(false);
    if (onDone) onDone();
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Team Name *</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Buffalos AI" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Team mission and scope"
          className="min-h-[72px]"
        />
      </div>
      <div className="space-y-2">
        <Label>Goal *</Label>
        <Textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Generate and ship high-quality output"
          className="min-h-[72px]"
        />
      </div>
      <div className="space-y-2">
        <Label>KPIs (comma or newline separated)</Label>
        <Textarea value={kpisRaw} onChange={(event) => setKpisRaw(event.target.value)} className="min-h-[72px]" />
      </div>
      <BusinessBuilderForm value={builderDraft} onChange={setBuilderDraft} disabled={isSubmitting} />
      {builderDraft.businessType === "none" ? (
        <div className="space-y-2">
          <Label>Auto Roles</Label>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeBuilder} onChange={(event) => setIncludeBuilder(event.target.checked)} />
              builder
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeGrowth} onChange={(event) => setIncludeGrowth(event.target.checked)} />
              growth_marketer
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includePm} onChange={(event) => setIncludePm(event.target.checked)} />
              pm
            </label>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Business teams auto-create PM and Executor agents.</p>
      )}
      <div className="space-y-2">
        <Label>Options</Label>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={registerOpenclawAgents}
              onChange={(event) => setRegisterOpenclawAgents(event.target.checked)}
            />
            Register new role agents in OpenClaw config
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withCluster} onChange={(event) => setWithCluster(event.target.checked)} />
            Create team cluster object in office layout
          </label>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-green-500">{success}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={reset} disabled={isSubmitting}>
          Reset
        </Button>
        <Button onClick={() => void onSubmit()} disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Team"}
        </Button>
      </div>
    </div>
  );
}
