"use client";

import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import type { EmployeeData } from "@/lib/types";
import type { Id } from "@/convex/_generated/dataModel";

interface AgentManagerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AgentManager({ isOpen, onOpenChange }: AgentManagerProps) {
    const { company, teams, employees, desks } = useOfficeDataContext();
    const createEmployee = useMutation(api.office_system.employees.createEmployee);

    const [name, setName] = useState("");
    const [teamId, setTeamId] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [deskId, setDeskId] = useState("");

    // Calculate available desks
    const availableDesks = useMemo(() => {
        const occupiedDeskIds = new Set<string>();
        employees.forEach((e: EmployeeData) => {
            if (e.deskId) occupiedDeskIds.add(e.deskId);
        });
        return desks.filter(d => !occupiedDeskIds.has(d.id));
    }, [desks, employees]);

    // Filter desks by selected team
    const teamDesks = useMemo(() => {
        if (!teamId) return [];
        const teamName = teams.find(t => t._id === teamId)?.name;
        if (!teamName) return [];

        return availableDesks.filter(d => d.team === teamName || d.team === "Unassigned");
    }, [availableDesks, teamId, teams]);

    const handleSubmit = async () => {
        if (!company || !teamId) return;

        try {
            await createEmployee({
                name,
                teamId: teamId as Id<"teams">,
                companyId: company._id,
                jobTitle,
                jobDescription: "New hire",
                gender: Math.random() > 0.5 ? "male" : "female",
                background: "New hire",
                personality: "Helpful",
                status: "none",
                statusMessage: "",
                isSupervisor: false,
                deskId: deskId ? (deskId as Id<"desks">) : undefined,
            });

            onOpenChange(false);
            // Reset form
            setName("");
            setJobTitle(""); // Keep team selected for convenience? No, reset.
            setTeamId("");
            setDeskId("");
        } catch (error) {
            console.error("Failed to create employee:", error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Recruit Agent</DialogTitle>
                    <DialogDescription>
                        Add a new AI agent to your team.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="team" className="text-right">Team</Label>
                        <Select value={teamId} onValueChange={setTeamId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select Team" />
                            </SelectTrigger>
                            <SelectContent>
                                {teams.map(t => (
                                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">Role</Label>
                        <Input id="role" value={jobTitle} onChange={e => setJobTitle(e.target.value)} className="col-span-3" />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="desk" className="text-right">Desk</Label>
                        <Select value={deskId} onValueChange={setDeskId} disabled={!teamId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder={!teamId ? "Select Team First" : "Assign Desk (Optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                                {teamDesks.map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.team === "Unassigned" ? "Unassigned Desk" : "Team Desk"} ({d.id.slice(0, 8)}...)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={!name || !teamId || !jobTitle}>
                        Recruit
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

