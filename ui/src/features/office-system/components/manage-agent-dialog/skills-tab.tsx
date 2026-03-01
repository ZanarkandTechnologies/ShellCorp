"use client";

import { Id } from "@/convex/_generated/dataModel";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Doc } from "@/convex/_generated/dataModel";

interface SkillsTabProps {
    allSkills: Doc<"skillConfigs">[] | undefined;
    selectedSkills: Id<"skillConfigs">[];
    toggleSkill: (skillId: Id<"skillConfigs">) => void;
}

export function SkillsTab({
    allSkills,
    selectedSkills,
    toggleSkill,
}: SkillsTabProps) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Available Skills ({selectedSkills.length} selected)
                </Label>
                <p className="text-sm text-muted-foreground">
                    Select skills this agent possesses. Skills represent workflows and best practices for using tools.
                </p>

                {allSkills && allSkills.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {allSkills.map((skill) => {
                            const isSelected = selectedSkills.includes(skill._id);
                            return (
                                <div
                                    key={skill._id}
                                    onClick={() => toggleSkill(skill._id)}
                                    className={cn(
                                        "p-3 border rounded-md cursor-pointer transition-colors",
                                        isSelected
                                            ? "border-primary bg-primary/10"
                                            : "border-border hover:border-primary/50"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{skill.name}</span>
                                                {isSelected && (
                                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                                )}
                                            </div>
                                            {skill.description && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {skill.description}
                                                </p>
                                            )}
                                            {skill.category && (
                                                <Badge variant="outline" className="mt-1 text-xs">
                                                    {skill.category}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                        No skills available. Create skills in the skill configs.
                    </p>
                )}
            </div>
        </div>
    );
}
