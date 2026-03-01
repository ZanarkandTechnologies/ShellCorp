"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User } from "lucide-react";
import { useAppStore } from "@/lib/app-store";
import { useUIMessages } from "@convex-dev/agent/react";
import { ChatUIMessage } from "@/convex/chat_system/chats";
import { OverviewTab } from "./overview-tab";
import { ToolsTab } from "./tools-tab";
import { SkillsTab } from "./skills-tab";
import { AgentLoopTab } from "./agent-loop-tab";
import { GoalsTab } from "./goals-tab";

export function ManageAgentDialog() {
    const manageAgentEmployeeId = useAppStore((state) => state.manageAgentEmployeeId);
    const setManageAgentEmployeeId = useAppStore((state) => state.setManageAgentEmployeeId);

    const isOpen = manageAgentEmployeeId !== null;
    const employeeId = manageAgentEmployeeId;

    const handleClose = (open: boolean) => {
        if (!open) {
            setManageAgentEmployeeId(null);
        }
    };
    const employee = useQuery(
        api.office_system.employees.getEmployee,
        employeeId ? { employeeId } : "skip"
    );

    const agentConfig = useQuery(
        api.agents_system.agentConfigs.getAgentByEmployeeId,
        employeeId ? { employeeId } : "skip"
    );

    const allTools = useQuery(api.agents_system.tools.toolConfigs.listToolConfigs, {
        activeOnly: true,
    });

    const allSkills = useQuery(api.agents_system.skills.skillConfigs.listSkillConfigs, {
        activeOnly: true,
    });

    const getOrCreateAgent = useMutation(
        api.agents_system.agentConfigs.getOrCreateAgentForEmployee
    );
    const updateAgent = useMutation(api.agents_system.agentConfigs.updateAgent);
    const updateEmployee = useMutation(api.office_system.employees.updateEmployee);

    const team = useQuery(
        api.office_system.teams.getTeamById,
        employee?.teamId ? { teamId: employee.teamId } : "skip"
    );

    const allTeams = useQuery(
        api.office_system.teams.getAllTeams,
        employee?.companyId ? { companyId: employee.companyId } : "skip"
    );

    const [systemPrompt, setSystemPrompt] = useState("");
    const [selectedTools, setSelectedTools] = useState<Id<"toolConfigs">[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<Id<"skillConfigs">[]>([]);
    const [businessResponsibilities, setBusinessResponsibilities] = useState("");
    const [name, setName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [background, setBackground] = useState("");
    const [personality, setPersonality] = useState("");
    const [profileImageUrl, setProfileImageUrl] = useState("");
    const [selectedTeamId, setSelectedTeamId] = useState<Id<"teams"> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedToolsets, setExpandedToolsets] = useState<Set<string>>(new Set());
    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Agent loop workflow state and mutations
    const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
    const [workflowError, setWorkflowError] = useState<string | null>(null);

    // Query for workflow status (reactive)
    const workflowStatus = useQuery(
        api.orchestration.agent_loop.status.getWorkflowStatus,
        employeeId ? { employeeId } : "skip"
    );

    // Query for loop thread (to display messages)
    const loopThread = useQuery(
        api.orchestration.agent_loop.status.getLoopThreadPublic,
        employeeId ? { employeeId } : "skip"
    );

    // Fetch messages from the loop thread
    const {
        results: loopMessagesRaw,
        status: messagesStatus,
    } = useUIMessages(
        api.chat_system.chats.listThreadMessages,
        loopThread?.threadId ? { threadId: loopThread.threadId } : "skip",
        { initialNumItems: 50, stream: true }
    );

    const loopMessages = loopMessagesRaw as (ChatUIMessage & { key: string })[];

    // Workflow lifecycle mutations
    const startAgentLoop = useMutation(api.orchestration.agent_loop.workflow.startAgentLoop);
    const pauseAgentLoop = useMutation(api.orchestration.agent_loop.workflow.pauseAgentLoop);
    const resumeAgentLoop = useMutation(api.orchestration.agent_loop.workflow.resumeAgentLoop);
    const stopAgentLoop = useMutation(api.orchestration.agent_loop.workflow.stopAgentLoop);

    // Initialize form when data loads
    useEffect(() => {
        if (employee) {
            setName(employee.name);
            setJobTitle(employee.jobTitle);
            setBusinessResponsibilities(employee.jobDescription || "");
            setBackground(employee.background || "");
            setPersonality(employee.personality || "");
            setProfileImageUrl(employee.profileImageUrl || "");
            setSelectedTeamId(employee.teamId || null);
        }
    }, [employee]);

    useEffect(() => {
        if (agentConfig) {
            setSystemPrompt(agentConfig.systemPrompt || "");
            setSelectedTools(agentConfig.tools || []);
            setSelectedSkills(agentConfig.skills || []);
        } else if (employee && !agentConfig) {
            // Initialize with employee data using variables
            setSystemPrompt(
                `You are {{name}}, a {{jobTitle}}. {{background}}\n\nPersonality: {{personality}}\n\nJob Description: {{jobDescription}}`
            );
        }
    }, [agentConfig, employee]);

    // Get tool/skill names for display
    const toolMap = useMemo(() => {
        if (!allTools) return new Map();
        return new Map(allTools.map(t => [t._id, t]));
    }, [allTools]);

    const skillMap = useMemo(() => {
        if (!allSkills) return new Map();
        return new Map(allSkills.map(s => [s._id, s]));
    }, [allSkills]);

    const handleSave = async () => {
        if (!employeeId) return;

        setIsLoading(true);
        try {
            let agentId: Id<"agentConfigs">;

            if (!agentConfig) {
                // Create agent config if it doesn't exist
                agentId = await getOrCreateAgent({ employeeId });
            } else {
                agentId = agentConfig._id;
            }

            // Update agent config
            await updateAgent({
                agentId,
                systemPrompt,
                tools: selectedTools,
                skills: selectedSkills,
            });

            // Update employee details
            await updateEmployee({
                employeeId,
                name,
                jobTitle,
                jobDescription: businessResponsibilities,
                background,
                personality,
                profileImageUrl,
                teamId: selectedTeamId || undefined,
            });

            handleClose(false);
        } catch (error) {
            console.error("Failed to save agent config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTool = (toolId: Id<"toolConfigs">) => {
        setSelectedTools(prev =>
            prev.includes(toolId)
                ? prev.filter(id => id !== toolId)
                : [...prev, toolId]
        );
    };

    const toggleToolset = (toolsetId: string) => {
        setExpandedToolsets(prev => {
            const next = new Set(prev);
            if (next.has(toolsetId)) {
                next.delete(toolsetId);
            } else {
                next.add(toolsetId);
            }
            return next;
        });
    };

    const selectAllToolsInToolset = (toolsetId: string, toolIds: Id<"toolConfigs">[]) => {
        setSelectedTools(prev => {
            const toolsetToolIds = new Set(toolIds);
            const allSelected = toolIds.every(id => prev.includes(id));

            if (allSelected) {
                // Deselect all tools in this toolset
                return prev.filter(id => !toolsetToolIds.has(id));
            } else {
                // Select all tools in this toolset
                const newSelection = [...prev];
                toolIds.forEach(id => {
                    if (!newSelection.includes(id)) {
                        newSelection.push(id);
                    }
                });
                return newSelection;
            }
        });
    };

    // Group tools by toolset
    const toolsByToolset = useMemo((): Map<string, NonNullable<typeof allTools>> => {
        const grouped = new Map<string, NonNullable<typeof allTools>>();
        if (!allTools) return grouped;

        allTools.forEach(tool => {
            // Parse implementationPath (format: "toolsetId:toolId")
            const toolsetId = tool.implementationPath?.split(':')[0] || 'other';
            if (!grouped.has(toolsetId)) {
                grouped.set(toolsetId, []);
            }
            grouped.get(toolsetId)!.push(tool);
        });

        return grouped;
    }, [allTools]);

    const toggleSkill = (skillId: Id<"skillConfigs">) => {
        setSelectedSkills(prev =>
            prev.includes(skillId)
                ? prev.filter(id => id !== skillId)
                : [...prev, skillId]
        );
    };

    const insertVariable = (variable: string) => {
        const textarea = promptTextareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = systemPrompt;
        const before = text.substring(0, start);
        const after = text.substring(end);
        const variableText = `{{ ${variable} }}`;

        setSystemPrompt(before + variableText + after);

        // Set cursor position after inserted variable
        setTimeout(() => {
            textarea.focus();
            const newPosition = start + variableText.length;
            textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
    };

    const isVariableInPrompt = (variable: string): boolean => {
        // Check if variable exists in prompt (with or without spaces)
        const regex = new RegExp(`{{\\s*${variable}\\s*}}`, "g");
        return regex.test(systemPrompt);
    };

    const allVariables = ["name", "jobTitle", "jobDescription", "background", "personality", "status", "statusMessage"];
    const availableVariables = allVariables.filter(v => !isVariableInPrompt(v));

    // Agent Loop workflow handlers
    const handleStartLoop = async () => {
        if (!employeeId) return;
        setIsWorkflowLoading(true);
        setWorkflowError(null);
        try {
            await startAgentLoop({ employeeId, intervalMinutes: 30 });
        } catch (error) {
            setWorkflowError(error instanceof Error ? error.message : "Failed to start");
        } finally {
            setIsWorkflowLoading(false);
        }
    };

    const handlePauseLoop = async () => {
        if (!employeeId) return;
        setIsWorkflowLoading(true);
        setWorkflowError(null);
        try {
            await pauseAgentLoop({ employeeId });
        } catch (error) {
            setWorkflowError(error instanceof Error ? error.message : "Failed to pause");
        } finally {
            setIsWorkflowLoading(false);
        }
    };

    const handleResumeLoop = async () => {
        if (!employeeId) return;
        setIsWorkflowLoading(true);
        setWorkflowError(null);
        try {
            await resumeAgentLoop({ employeeId });
        } catch (error) {
            setWorkflowError(error instanceof Error ? error.message : "Failed to resume");
        } finally {
            setIsWorkflowLoading(false);
        }
    };

    const handleStopLoop = async () => {
        if (!employeeId) return;
        setIsWorkflowLoading(true);
        setWorkflowError(null);
        try {
            await stopAgentLoop({ employeeId });
        } catch (error) {
            setWorkflowError(error instanceof Error ? error.message : "Failed to stop");
        } finally {
            setIsWorkflowLoading(false);
        }
    };

    // Workflow status helpers (using agentLoopSessions table)
    const isRunning = workflowStatus?.status === "running";
    const isPaused = workflowStatus?.status === "paused";
    const isStopped = !workflowStatus?.workflowId ||
        ["completed", "cancelled", "failed"].includes(workflowStatus?.status ?? "");

    const getStatusBadgeVariant = (status: string | undefined) => {
        switch (status) {
            case "running": return "default";
            case "paused": return "secondary";
            case "completed": return "outline";
            case "cancelled": return "secondary";
            case "failed": return "destructive";
            default: return "outline";
        }
    };

    if (!employee) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-4xl min-h-[90vh] z-[1000]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Manage Agent: {employee.name}
                    </DialogTitle>
                    <DialogDescription>
                        Configure {employee.name}'s capabilities, tools, and responsibilities
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="goals">Goals</TabsTrigger>
                        <TabsTrigger value="tools">Tools</TabsTrigger>
                        <TabsTrigger value="skills">Skills</TabsTrigger>
                        <TabsTrigger value="agent-loop">Agent Loop</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="h-full min-h-[65vh] max-h-[65vh] mt-4 pr-3">
                        <TabsContent value="overview" className="space-y-6">
                            <OverviewTab
                                employee={employee}
                                name={name}
                                setName={setName}
                                jobTitle={jobTitle}
                                setJobTitle={setJobTitle}
                                profileImageUrl={profileImageUrl}
                                setProfileImageUrl={setProfileImageUrl}
                                selectedTeamId={selectedTeamId}
                                setSelectedTeamId={setSelectedTeamId}
                                allTeams={allTeams}
                                background={background}
                                setBackground={setBackground}
                                personality={personality}
                                setPersonality={setPersonality}
                                businessResponsibilities={businessResponsibilities}
                                setBusinessResponsibilities={setBusinessResponsibilities}
                                selectedToolsCount={selectedTools.length}
                                selectedSkillsCount={selectedSkills.length}
                                systemPrompt={systemPrompt}
                                setSystemPrompt={setSystemPrompt}
                                availableVariables={availableVariables}
                                insertVariable={insertVariable}
                                promptTextareaRef={promptTextareaRef as React.RefObject<HTMLTextAreaElement>}
                            />
                        </TabsContent>

                        <TabsContent value="goals" className="space-y-4">
                            <GoalsTab employeeId={employeeId!} />
                        </TabsContent>

                        <TabsContent value="tools" className="space-y-4">
                            <ToolsTab
                                allTools={allTools}
                                selectedTools={selectedTools}
                                toggleTool={toggleTool}
                                expandedToolsets={expandedToolsets}
                                toggleToolset={toggleToolset}
                                selectAllToolsInToolset={selectAllToolsInToolset}
                                toolsByToolset={toolsByToolset}
                            />
                        </TabsContent>

                        <TabsContent value="skills" className="space-y-4">
                            <SkillsTab
                                allSkills={allSkills}
                                selectedSkills={selectedSkills}
                                toggleSkill={toggleSkill}
                            />
                        </TabsContent>

                        <TabsContent value="agent-loop" className="space-y-4">
                            <AgentLoopTab
                                employeeId={employeeId!}
                                workflowStatus={workflowStatus ?? null}
                                workflowError={workflowError}
                                isWorkflowLoading={isWorkflowLoading}
                                isRunning={isRunning}
                                isPaused={isPaused}
                                isStopped={isStopped}
                                loopThread={loopThread ?? null}
                                loopMessages={loopMessages}
                                messagesStatus={messagesStatus}
                                handleStartLoop={handleStartLoop}
                                handlePauseLoop={handlePauseLoop}
                                handleResumeLoop={handleResumeLoop}
                                handleStopLoop={handleStopLoop}
                                getStatusBadgeVariant={getStatusBadgeVariant}
                            />
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => handleClose(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
