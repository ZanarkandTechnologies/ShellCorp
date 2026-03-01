"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Target, Plus, Trash2, CheckCircle2, Circle, Clock, Briefcase, ChevronDown, ChevronRight, Edit2, X, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface GoalsTabProps {
    employeeId: Id<"employees">;
}

export function GoalsTab({ employeeId }: GoalsTabProps) {
    const employee = useQuery(api.office_system.employees.getEmployee, { employeeId });
    const goals = useQuery(api.office_system.goals.getGoals, { employeeId });
    const projects = useQuery(api.office_system.projects.getProjectsByTeam, employee?.teamId ? { teamId: employee.teamId } : "skip");

    const addGoal = useMutation(api.office_system.goals.addGoal);
    const updateGoal = useMutation(api.office_system.goals.updateGoal);
    const deleteGoal = useMutation(api.office_system.goals.deleteGoal);

    const createProject = useMutation(api.office_system.projects.createProject);
    const updateProject = useMutation(api.office_system.projects.updateProject);
    const deleteProject = useMutation(api.office_system.projects.deleteProject);

    // Goal form state
    const [newGoalDescription, setNewGoalDescription] = useState("");
    const [newGoalPriority, setNewGoalPriority] = useState(3);
    const [isAdding, setIsAdding] = useState(false);
    const [expandedGoals, setExpandedGoals] = useState<Set<Id<"agentGoals">>>(new Set());

    // Project form state
    const [creatingProjectForGoal, setCreatingProjectForGoal] = useState<Id<"agentGoals"> | null>(null);
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectDescription, setNewProjectDescription] = useState("");
    const [newProjectStage, setNewProjectStage] = useState<string>("lead");

    // Editing project state
    const [editingProjectId, setEditingProjectId] = useState<Id<"projects"> | null>(null);
    const [editProjectName, setEditProjectName] = useState("");
    const [editProjectDescription, setEditProjectDescription] = useState("");
    const [editProjectStage, setEditProjectStage] = useState<string>("lead");

    const toggleGoalExpansion = (goalId: Id<"agentGoals">) => {
        setExpandedGoals(prev => {
            const next = new Set(prev);
            if (next.has(goalId)) next.delete(goalId);
            else next.add(goalId);
            return next;
        });
    };

    const handleAddGoal = async () => {
        if (!newGoalDescription.trim()) return;

        try {
            await addGoal({
                employeeId,
                description: newGoalDescription,
                priority: newGoalPriority,
                weight: 0.5,
                status: "active",
            });
            setNewGoalDescription("");
            setNewGoalPriority(3);
            setIsAdding(false);
        } catch (error) {
            console.error("Failed to add goal:", error);
        }
    };

    const handleToggleStatus = async (goal: Doc<"agentGoals">) => {
        const nextStatus = goal.status === "active" ? "completed" : "active";
        try {
            await updateGoal({
                goalId: goal._id,
                status: nextStatus,
            });
        } catch (error) {
            console.error("Failed to update goal status:", error);
        }
    };

    const handleDeleteGoal = async (goalId: Id<"agentGoals">) => {
        try {
            await deleteGoal({ goalId });
        } catch (error) {
            console.error("Failed to delete goal:", error);
        }
    };

    // Project handlers
    const handleCreateProject = async (goalId: Id<"agentGoals">) => {
        if (!newProjectName.trim() || !employee?.teamId || !employee?.companyId) return;

        try {
            await createProject({
                teamId: employee.teamId,
                companyId: employee.companyId,
                goalId,
                name: newProjectName,
                description: newProjectDescription || "No description provided",
                pipelineStage: newProjectStage as any,
            });
            resetProjectForm();
        } catch (error) {
            console.error("Failed to create project:", error);
        }
    };

    const handleStartEditProject = (project: Doc<"projects">) => {
        setEditingProjectId(project._id);
        setEditProjectName(project.name);
        setEditProjectDescription(project.description || "");
        setEditProjectStage(project.pipelineStage);
    };

    const handleUpdateProject = async (projectId: Id<"projects">) => {
        if (!editProjectName.trim()) return;

        try {
            await updateProject({
                projectId,
                name: editProjectName,
                description: editProjectDescription,
                pipelineStage: editProjectStage as any,
            });
            setEditingProjectId(null);
        } catch (error) {
            console.error("Failed to update project:", error);
        }
    };

    const handleDeleteProject = async (projectId: Id<"projects">) => {
        try {
            await deleteProject({ projectId });
        } catch (error) {
            console.error("Failed to delete project:", error);
        }
    };

    const resetProjectForm = () => {
        setCreatingProjectForGoal(null);
        setNewProjectName("");
        setNewProjectDescription("");
        setNewProjectStage("lead");
    };

    const getPriorityColor = (priority: number) => {
        if (priority >= 4) return "text-red-500 bg-red-500/10 border-red-500/20";
        if (priority >= 3) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
        return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    };

    const getStageColor = (stage: string) => {
        switch (stage) {
            case "lead": return "bg-slate-500/10 text-slate-600";
            case "qualified": return "bg-blue-500/10 text-blue-600";
            case "proposal": return "bg-purple-500/10 text-purple-600";
            case "negotiation": return "bg-amber-500/10 text-amber-600";
            case "won": return "bg-green-500/10 text-green-600";
            case "in_progress": return "bg-cyan-500/10 text-cyan-600";
            default: return "bg-muted text-muted-foreground";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Strategic Agent Goals
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Define high-level objectives for the agent. These will eventually drive multiple projects and tasks.
                    </p>
                </div>
                {!isAdding && (
                    <Button size="sm" onClick={() => setIsAdding(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Goal
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="goalDescription" className="text-xs font-bold uppercase tracking-wider">Description</Label>
                            <Input
                                id="goalDescription"
                                value={newGoalDescription}
                                onChange={(e) => setNewGoalDescription(e.target.value)}
                                placeholder="e.g. Optimize AWS costs by 20%"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-end gap-4">
                            <div className="space-y-2 flex-1">
                                <Label className="text-xs font-bold uppercase tracking-wider">Priority</Label>
                                <Select
                                    value={newGoalPriority.toString()}
                                    onValueChange={(v) => setNewGoalPriority(parseInt(v))}
                                >
                                    <SelectTrigger className="w-full bg-background">
                                        <SelectValue placeholder="Select Priority" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[1100]">
                                        <SelectItem value="1">P1 - Low</SelectItem>
                                        <SelectItem value="2">P2 - Medium-Low</SelectItem>
                                        <SelectItem value="3">P3 - Medium</SelectItem>
                                        <SelectItem value="4">P4 - High</SelectItem>
                                        <SelectItem value="5">P5 - Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleAddGoal}>Create Goal</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-3">
                {goals === undefined ? (
                    <div className="text-center py-8 text-muted-foreground animate-pulse">Loading goals...</div>
                ) : goals.length === 0 && !isAdding ? (
                    <div className="text-center py-12 border rounded-xl border-dashed bg-muted/20">
                        <Target className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm text-muted-foreground">No strategic goals defined yet.</p>
                        <Button variant="link" onClick={() => setIsAdding(true)}>Add your first goal</Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {goals.sort((a, b) => {
                            if (a.status !== b.status) return a.status === "active" ? -1 : 1;
                            return b.priority - a.priority;
                        }).map((goal) => {
                            const goalProjects = projects?.filter(p => p.goalId === goal._id) || [];
                            const isExpanded = expandedGoals.has(goal._id);
                            const isCreatingProject = creatingProjectForGoal === goal._id;

                            return (
                                <div key={goal._id} className="space-y-2">
                                    <div
                                        className={cn(
                                            "group flex items-center gap-4 p-4 rounded-xl border transition-all",
                                            goal.status === "active"
                                                ? "bg-background border-border hover:border-primary/30"
                                                : "bg-muted/30 border-transparent opacity-60"
                                        )}
                                    >
                                        <button
                                            onClick={() => handleToggleStatus(goal)}
                                            className="shrink-0 transition-transform active:scale-95"
                                        >
                                            {goal.status === "completed" ? (
                                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                                            ) : (
                                                <Circle className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                                            )}
                                        </button>

                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => toggleGoalExpansion(goal._id)}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 uppercase font-bold", getPriorityColor(goal.priority))}>
                                                    P{goal.priority}
                                                </Badge>
                                                {goal.deadline && (
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(goal.deadline).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {goalProjects.length > 0 && (
                                                    <Badge variant="secondary" className="text-[8px] h-4 px-1 gap-1">
                                                        <Briefcase className="w-2 h-2" />
                                                        {goalProjects.length} Projects
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className={cn(
                                                "text-sm font-medium transition-all flex items-center gap-2",
                                                goal.status === "completed" && "line-through text-muted-foreground"
                                            )}>
                                                {goal.description}
                                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            </p>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteGoal(goal._id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {isExpanded && (
                                        <div className="ml-10 space-y-3 border-l-2 border-muted pl-4 py-2 animate-in slide-in-from-left-2 duration-200">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projects</h4>
                                            </div>

                                            {goalProjects.length === 0 && !isCreatingProject ? (
                                                <div className="text-[10px] text-muted-foreground italic py-2">
                                                    No projects linked to this goal yet.
                                                </div>
                                            ) : (
                                                <div className="grid gap-2">
                                                    {goalProjects.map((project) => {
                                                        const isEditing = editingProjectId === project._id;

                                                        if (isEditing) {
                                                            return (
                                                                <div key={project._id} className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold uppercase tracking-wider">Name</Label>
                                                                        <Input
                                                                            value={editProjectName}
                                                                            onChange={(e) => setEditProjectName(e.target.value)}
                                                                            className="h-8 text-xs"
                                                                            autoFocus
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold uppercase tracking-wider">Description</Label>
                                                                        <Textarea
                                                                            value={editProjectDescription}
                                                                            onChange={(e) => setEditProjectDescription(e.target.value)}
                                                                            className="text-xs min-h-[60px]"
                                                                            placeholder="Project description..."
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-bold uppercase tracking-wider">Stage</Label>
                                                                        <Select value={editProjectStage} onValueChange={setEditProjectStage}>
                                                                            <SelectTrigger className="h-8 text-xs">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent className="z-[1100]">
                                                                                <SelectItem value="lead">Lead</SelectItem>
                                                                                <SelectItem value="qualified">Qualified</SelectItem>
                                                                                <SelectItem value="proposal">Proposal</SelectItem>
                                                                                <SelectItem value="negotiation">Negotiation</SelectItem>
                                                                                <SelectItem value="won">Won</SelectItem>
                                                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingProjectId(null)}>
                                                                            <X className="w-3 h-3 mr-1" /> Cancel
                                                                        </Button>
                                                                        <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdateProject(project._id)}>
                                                                            <Save className="w-3 h-3 mr-1" /> Save
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div
                                                                key={project._id}
                                                                className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-transparent hover:border-primary/20 transition-all group/project"
                                                            >
                                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                    <Briefcase className="w-3 h-3 text-primary/60 shrink-0" />
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-medium truncate">{project.name}</p>
                                                                        {project.description && (
                                                                            <p className="text-[9px] text-muted-foreground truncate">{project.description}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className={cn("text-[8px] h-4 shrink-0", getStageColor(project.pipelineStage))}>
                                                                        {project.pipelineStage}
                                                                    </Badge>
                                                                    <div className="flex gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6"
                                                                            onClick={() => handleStartEditProject(project)}
                                                                        >
                                                                            <Edit2 className="w-3 h-3" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-destructive"
                                                                            onClick={() => handleDeleteProject(project._id)}
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Inline Project Creation Form */}
                                            {isCreatingProject ? (
                                                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-3 mt-2">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase tracking-wider">Project Name</Label>
                                                        <Input
                                                            value={newProjectName}
                                                            onChange={(e) => setNewProjectName(e.target.value)}
                                                            placeholder="e.g. E-commerce Platform"
                                                            className="h-8 text-xs"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase tracking-wider">Description</Label>
                                                        <Textarea
                                                            value={newProjectDescription}
                                                            onChange={(e) => setNewProjectDescription(e.target.value)}
                                                            placeholder="Brief description..."
                                                            className="text-xs min-h-[60px]"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-bold uppercase tracking-wider">Pipeline Stage</Label>
                                                        <Select value={newProjectStage} onValueChange={setNewProjectStage}>
                                                            <SelectTrigger className="h-8 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="z-[1100]">
                                                                <SelectItem value="lead">Lead</SelectItem>
                                                                <SelectItem value="qualified">Qualified</SelectItem>
                                                                <SelectItem value="proposal">Proposal</SelectItem>
                                                                <SelectItem value="negotiation">Negotiation</SelectItem>
                                                                <SelectItem value="won">Won</SelectItem>
                                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetProjectForm}>
                                                            <X className="w-3 h-3 mr-1" /> Cancel
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleCreateProject(goal._id)}
                                                            disabled={!newProjectName.trim()}
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" /> Create Project
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-7 text-[9px] border-dashed gap-1"
                                                    onClick={() => setCreatingProjectForGoal(goal._id)}
                                                >
                                                    <Plus className="w-2 h-2" />
                                                    New Project for Goal
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
