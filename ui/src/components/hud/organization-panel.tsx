"use client";

import { useMemo, useState } from "react";
import type { Id } from "@/lib/entity-types";
import { Building2, Briefcase, MapPin, Search, User, UserSearch, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { useAppStore } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { UI_Z } from "@/lib/z-index";
import type { EmployeeData } from "@/lib/types";

interface OrganizationPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canOpenTeamManager: boolean;
  canOpenAgentManager: boolean;
}

function parseKpiList(input: string): string[] {
  return [...new Set(input.split(/[,\n]/g).map((entry) => entry.trim()).filter(Boolean))];
}

function CreateTeamTabContent({ onDone }: { onDone?: () => void }): React.JSX.Element {
  const { refresh } = useOfficeDataContext();
  const adapter = useOpenClawAdapter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [kpisRaw, setKpisRaw] = useState("weekly_shipped_tickets, closed_vs_open_ticket_ratio");
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
    const result = await adapter.createTeam({
      name: trimmedName,
      description: description.trim(),
      goal: trimmedGoal,
      kpis: parseKpiList(kpisRaw),
      autoRoles,
      registerOpenclawAgents,
      withCluster,
    });
    if (!result.ok) {
      setError(result.error ?? "Failed to create team.");
      setIsSubmitting(false);
      return;
    }
    await refresh();
    setSuccess("Team created.");
    setIsSubmitting(false);
    if (onDone) onDone();
    reset();
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
          placeholder="Generate and ship high-quality Minecraft mods"
          className="min-h-[72px]"
        />
      </div>
      <div className="space-y-2">
        <Label>KPIs (comma or newline separated)</Label>
        <Textarea value={kpisRaw} onChange={(event) => setKpisRaw(event.target.value)} className="min-h-[72px]" />
      </div>
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

function RecruitAgentTabContent({ canOpen }: { canOpen: boolean }): React.JSX.Element {
  if (!canOpen) {
    return <p className="text-sm text-muted-foreground">Recruit Agent is unavailable in the current backend mode.</p>;
  }
  return <p className="text-sm text-muted-foreground">Recruit Agent is temporarily unavailable in WS-only mode.</p>;
}

function ManageTeamsTabContent({ canOpen }: { canOpen: boolean }): React.JSX.Element {
  if (!canOpen) {
    return <p className="text-sm text-muted-foreground">Manage Teams is unavailable in the current backend mode.</p>;
  }
  return <p className="text-sm text-muted-foreground">Manage Teams is temporarily unavailable in WS-only mode.</p>;
}

function DirectoryTabContent(): React.JSX.Element {
  const { employees } = useOfficeDataContext();
  const [searchQuery, setSearchQuery] = useState("");
  const highlightedEmployeeIds = useAppStore((state) => state.highlightedEmployeeIds);
  const setHighlightedEmployeeIds = useAppStore((state) => state.setHighlightedEmployeeIds);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const query = searchQuery.toLowerCase();
    return employees.filter((employee) => {
      const nameMatch = employee.name.toLowerCase().includes(query);
      const jobTitleMatch = employee.jobTitle?.toLowerCase().includes(query);
      const teamMatch = employee.team?.toLowerCase().includes(query);
      return nameMatch || jobTitleMatch || teamMatch;
    });
  }, [employees, searchQuery]);

  const employeesByTeam = useMemo(() => {
    const grouped = new Map<string, typeof employees>();
    for (const employee of filteredEmployees) {
      const teamName = employee.team || "Unassigned";
      if (!grouped.has(teamName)) grouped.set(teamName, []);
      grouped.get(teamName)!.push(employee);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEmployees]);

  const handleLocate = (employeeId: Id<"employees">): void => {
    setHighlightedEmployeeIds([employeeId]);
    setTimeout(() => {
      setHighlightedEmployeeIds(null);
    }, 30000);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, job title, or team..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>
      {highlightedEmployeeIds.size > 0 ? (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setHighlightedEmployeeIds(null)}>
            Clear Highlight
          </Button>
        </div>
      ) : null}
      <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {employeesByTeam.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <User className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>No employees found</p>
          </div>
        ) : (
          employeesByTeam.map(([teamName, teamEmployees]) => (
            <div key={teamName} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground">{teamName}</h3>
                <Badge variant="secondary" className="ml-auto">{teamEmployees.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {teamEmployees.map((employee) => (
                  <Card key={employee._id} className={cn(highlightedEmployeeIds.has(employee._id) ? "ring-2 ring-primary" : undefined)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {employee.name}
                        {employee.isCEO ? <Badge variant="default" className="text-xs">CEO</Badge> : null}
                      </CardTitle>
                      {employee.jobTitle ? (
                        <CardDescription className="flex items-center gap-2">
                          <Briefcase className="h-3 w-3" />
                          {employee.jobTitle}
                        </CardDescription>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{employee.team}</span>
                      <Button size="sm" variant="outline" onClick={() => handleLocate(employee._id)}>
                        <MapPin className="mr-1 h-3 w-3" />
                        {highlightedEmployeeIds.has(employee._id) ? "Locating..." : "Locate"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
        <span>Showing {filteredEmployees.length} of {employees.length} employees</span>
        {highlightedEmployeeIds.size > 0 ? (
          <span className="text-primary">Employee highlighted in scene</span>
        ) : null}
      </div>
    </div>
  );
}

export function OrganizationPanel({
  isOpen,
  onOpenChange,
  canOpenTeamManager,
  canOpenAgentManager,
}: OrganizationPanelProps): React.JSX.Element {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" style={{ zIndex: UI_Z.panelBase }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization
          </DialogTitle>
          <DialogDescription>
            Team and people operations in one panel.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="create-team" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create-team">Create Team</TabsTrigger>
            <TabsTrigger value="manage-teams">Manage Teams</TabsTrigger>
            <TabsTrigger value="recruit-agent">Recruit Agent</TabsTrigger>
            <TabsTrigger value="directory">Directory</TabsTrigger>
          </TabsList>

          <TabsContent value="create-team" className="mt-4">
            <CreateTeamTabContent />
          </TabsContent>

          <TabsContent value="manage-teams" className="mt-4">
            <ManageTeamsTabContent canOpen={canOpenTeamManager} />
          </TabsContent>

          <TabsContent value="recruit-agent" className="mt-4">
            <RecruitAgentTabContent canOpen={canOpenAgentManager} />
          </TabsContent>

          <TabsContent value="directory" className="mt-4">
            <DirectoryTabContent />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
