"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Brain, FlaskConical, Microscope, ArrowLeft, Play, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";

interface TrainingModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    employeeName?: string;
}

export function TrainingModal({ isOpen, onOpenChange, employeeName = "Agent" }: TrainingModalProps) {
    const [view, setView] = useState<"dashboard" | "experiment" | "learn">("dashboard");
    const [expBenchmark, setExperimentBenchmark] = useState("");
    const [expValidation, setExperimentValidation] = useState("automated");

    const skills = [
        { name: "React Development", level: "Expert", xp: 1200 },
        { name: "Node.js Backend", level: "Competent", xp: 850 },
        { name: "SQL Database", level: "Novice", xp: 300 },
    ];

    const stats = {
        tasksCompleted: 42,
        avgScore: 8.5,
    };

    const handleStartExperiment = () => {
        toast.success("Experiment Initialized: Layout 1 Arena Spawning...");
        onOpenChange(false);
        setView("dashboard");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="min-w-[80vw] min-h-[80vh] flex flex-col p-0 gap-0 bg-background z-[1000]">
                <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
                    <div className="flex items-center gap-4">
                        {view !== "dashboard" ? (
                            <Button variant="ghost" size="icon" onClick={() => setView("dashboard")}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        ) : null}
                        <div>
                            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                                <Brain className="h-5 w-5 text-primary" />
                                Training Hub: {employeeName}
                            </DialogTitle>
                            <DialogDescription className="text-xs mt-1">
                                Manage skill acquisition and self-improvement experiments
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-72 border-r bg-muted/10 p-6 flex flex-col gap-6 overflow-y-auto">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Current Skills</h3>
                            <div className="space-y-2">
                                {skills.map((skill) => (
                                    <div key={skill.name} className="flex items-center justify-between p-2 bg-background border rounded-md shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{skill.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{skill.level}</span>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px]">{skill.xp} XP</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Performance Stats</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <Card className="p-3 flex flex-col items-center justify-center bg-background/50">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mb-1" />
                                    <span className="text-xl font-bold">{stats.tasksCompleted}</span>
                                    <span className="text-[10px] text-muted-foreground">Tasks</span>
                                </Card>
                                <Card className="p-3 flex flex-col items-center justify-center bg-background/50">
                                    <Trophy className="h-4 w-4 text-amber-500 mb-1" />
                                    <span className="text-xl font-bold">{stats.avgScore}</span>
                                    <span className="text-[10px] text-muted-foreground">Avg Score</span>
                                </Card>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto bg-background p-8">
                        {view === "dashboard" ? (
                            <div className="max-w-4xl mx-auto space-y-8">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">Select Action</h2>
                                    <p className="text-muted-foreground">Choose how you want to improve your capabilities today.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md group" onClick={() => setView("learn")}>
                                        <div className="p-6 space-y-3">
                                            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                                <Brain className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <h3 className="font-semibold">Learn New Skill</h3>
                                            <p className="text-sm text-muted-foreground">Acquire new capabilities through deep research and practice.</p>
                                        </div>
                                    </Card>
                                    <Card className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md group" onClick={() => toast.info("Deep Research module coming soon")}>
                                        <div className="p-6 space-y-3">
                                            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                                <Microscope className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                                            </div>
                                            <h3 className="font-semibold">Deep Research</h3>
                                            <p className="text-sm text-muted-foreground">Refine existing knowledge with targeted study.</p>
                                        </div>
                                    </Card>
                                    <Card className="hover:border-primary/50 cursor-pointer transition-all hover:shadow-md group border-primary/20 bg-primary/5" onClick={() => setView("experiment")}>
                                        <div className="p-6 space-y-3">
                                            <div className="p-3 bg-primary/20 rounded-lg w-fit group-hover:scale-110 transition-transform">
                                                <FlaskConical className="h-6 w-6 text-primary" />
                                            </div>
                                            <h3 className="font-semibold">Run Self-Improvement Experiment</h3>
                                            <p className="text-sm text-muted-foreground">Initialize a Layout 1 Arena to benchmark and optimize performance.</p>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        ) : null}

                        {view === "experiment" ? (
                            <div className="max-w-3xl mx-auto">
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold flex items-center gap-2">
                                        <FlaskConical className="h-6 w-6 text-primary" />
                                        Experiment Setup
                                    </h2>
                                </div>
                                <Card className="p-6 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Target Benchmark</Label>
                                            <Select value={expBenchmark} onValueChange={setExperimentBenchmark}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a benchmark suite..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="buildbench">BuildBench (Coding)</SelectItem>
                                                    <SelectItem value="writebench">WriteBench (Writing)</SelectItem>
                                                    <SelectItem value="researchbench">ResearchBench</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Validation Method</Label>
                                            <Select value={expValidation} onValueChange={setExperimentValidation}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="automated">Automated Tests Only (Fast)</SelectItem>
                                                    <SelectItem value="hybrid">Automated + LLM Judge (Balanced)</SelectItem>
                                                    <SelectItem value="human">Human Review (Slow)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" onClick={() => setView("dashboard")}>Cancel</Button>
                                        <Button onClick={handleStartExperiment} disabled={!expBenchmark} className="gap-2">
                                            <Play className="h-4 w-4" />
                                            Start Experiment
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        ) : null}

                        {view === "learn" ? (
                            <div className="max-w-3xl mx-auto space-y-4">
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Brain className="h-6 w-6 text-blue-600" />
                                    Learn New Skill
                                </h2>
                                <div className="space-y-2">
                                    <Label>Topic / Skill Name</Label>
                                    <Input placeholder="e.g., Rust Programming, Advanced SEO, etc." />
                                </div>
                                <div className="space-y-2">
                                    <Label>Learning Focus</Label>
                                    <Input placeholder="What specific aspects should be prioritized?" />
                                </div>
                                <Button className="w-full" onClick={() => { toast.success("Research Started"); setView("dashboard"); }}>
                                    Start Deep Research
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

