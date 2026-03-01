"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Target, MessageSquare } from "lucide-react";
import { Doc } from "@/convex/_generated/dataModel";
import { RefObject } from "react";

interface OverviewTabProps {
    employee: Doc<"employees">;
    name: string;
    setName: (name: string) => void;
    jobTitle: string;
    setJobTitle: (title: string) => void;
    profileImageUrl: string;
    setProfileImageUrl: (url: string) => void;
    selectedTeamId: Id<"teams"> | null;
    setSelectedTeamId: (teamId: Id<"teams"> | null) => void;
    allTeams: Doc<"teams">[] | undefined;
    background: string;
    setBackground: (bg: string) => void;
    personality: string;
    setPersonality: (p: string) => void;
    businessResponsibilities: string;
    setBusinessResponsibilities: (resp: string) => void;
    selectedToolsCount: number;
    selectedSkillsCount: number;
    systemPrompt: string;
    setSystemPrompt: (prompt: string) => void;
    availableVariables: string[];
    insertVariable: (variable: string) => void;
    promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function OverviewTab({
    employee,
    name,
    setName,
    jobTitle,
    setJobTitle,
    profileImageUrl,
    setProfileImageUrl,
    selectedTeamId,
    setSelectedTeamId,
    allTeams,
    background,
    setBackground,
    personality,
    setPersonality,
    businessResponsibilities,
    setBusinessResponsibilities,
    selectedToolsCount,
    selectedSkillsCount,
    systemPrompt,
    setSystemPrompt,
    availableVariables,
    insertVariable,
    promptTextareaRef,
}: OverviewTabProps) {
    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex gap-6 items-start p-4 bg-muted/30 rounded-xl border">
                <div className="space-y-2 text-center">
                    <Avatar className="w-24 h-24 border-4 border-background shadow-sm">
                        <AvatarImage src={profileImageUrl} />
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                            {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="text-xs text-muted-foreground truncate w-24">
                        {employee.status}
                    </div>
                </div>

                <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-lg font-semibold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="jobTitle" className="text-xs font-medium text-muted-foreground uppercase">Job Title</Label>
                            <Input
                                id="jobTitle"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="team" className="text-xs font-medium text-muted-foreground uppercase">Team</Label>
                            <Select
                                value={selectedTeamId || undefined}
                                onValueChange={(value) => setSelectedTeamId(value as Id<"teams">)}
                            >
                                <SelectTrigger id="team" className="bg-background">
                                    <SelectValue placeholder="Select a team" />
                                </SelectTrigger>
                                <SelectContent className="z-[1100]">
                                    {allTeams?.map((t) => (
                                        <SelectItem key={t._id} value={t._id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                                    {(!allTeams || allTeams.length === 0) && (
                                        <SelectItem value="_none" disabled>
                                            No teams available
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="profileImage" className="text-xs font-medium text-muted-foreground uppercase">Profile Image URL</Label>
                            <Input
                                id="profileImage"
                                value={profileImageUrl}
                                onChange={(e) => setProfileImageUrl(e.target.value)}
                                placeholder="https://..."
                                className="text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-background border rounded-lg flex flex-col items-center justify-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Tools</span>
                    <span className="text-2xl font-bold">{selectedToolsCount}</span>
                </div>
                <div className="p-3 bg-background border rounded-lg flex flex-col items-center justify-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Skills</span>
                    <span className="text-2xl font-bold">{selectedSkillsCount}</span>
                </div>
                <div className="p-3 bg-background border rounded-lg flex flex-col items-center justify-center gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Status</span>
                    <Badge variant={employee.status === "success" ? "default" : employee.status === "warning" ? "destructive" : "secondary"}>
                        {employee.status}
                    </Badge>
                </div>
            </div>

            {/* System Prompt Section */}
            <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        System Prompt
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        Define the agent's personality, role, and behavior. This prompt is used as the system message in conversations.
                    </p>
                    {availableVariables.length > 0 && (
                        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md mb-2">
                            <span className="font-semibold">Available Variables:</span>
                            <div className="flex flex-wrap gap-2 mt-1 font-mono">
                                {availableVariables.map((variable) => (
                                    <Badge
                                        key={variable}
                                        variant="secondary"
                                        className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors font-mono"
                                        onClick={() => insertVariable(variable)}
                                    >
                                        {`{{ ${variable} }}`}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                    <Textarea
                        ref={promptTextareaRef}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Enter system prompt..."
                        className="min-h-[200px] font-mono text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Background
                        </Label>
                        <Textarea
                            value={background}
                            onChange={(e) => setBackground(e.target.value)}
                            placeholder="Enter agent background story..."
                            className="min-h-[120px] resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Personality
                        </Label>
                        <Textarea
                            value={personality}
                            onChange={(e) => setPersonality(e.target.value)}
                            placeholder="Describe the agent's personality..."
                            className="min-h-[120px] resize-none"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2 h-full flex flex-col">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            Business Responsibilities
                        </Label>
                        <Textarea
                            value={businessResponsibilities}
                            onChange={(e) => setBusinessResponsibilities(e.target.value)}
                            placeholder="Define what this agent is responsible for..."
                            className="flex-1 min-h-[200px] resize-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
