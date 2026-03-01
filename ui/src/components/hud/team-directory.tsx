/**
 * TEAM DIRECTORY
 * ==============
 * 
 * Directory component for viewing and locating employees.
 * 
 * FEATURES:
 * - Search employees by name, job title, or team
 * - Locate button highlights employee in 3D scene with arrow
 * - View all employees with their details
 * 
 * USAGE:
 * - Opened from speed-dial menu
 * - Click "Locate" to highlight and focus on employee
 */
"use client";

import { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, MapPin, User, Briefcase, Users } from "lucide-react";
import { useOfficeDataContext } from "@/providers/office-data-provider";
import { useAppStore } from "@/lib/app-store";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface TeamDirectoryProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TeamDirectory({ isOpen, onOpenChange }: TeamDirectoryProps) {
    const { employees, teams } = useOfficeDataContext();
    const [searchQuery, setSearchQuery] = useState("");
    const highlightedEmployeeIds = useAppStore(state => state.highlightedEmployeeIds);
    const setHighlightedEmployeeIds = useAppStore(state => state.setHighlightedEmployeeIds);

    // Filter employees based on search query
    const filteredEmployees = useMemo(() => {
        if (!searchQuery.trim()) return employees;

        const query = searchQuery.toLowerCase();
        return employees.filter((emp) => {
            const nameMatch = emp.name.toLowerCase().includes(query);
            const jobTitleMatch = emp.jobTitle?.toLowerCase().includes(query);
            const teamMatch = emp.team?.toLowerCase().includes(query);
            return nameMatch || jobTitleMatch || teamMatch;
        });
    }, [employees, searchQuery]);

    // Group employees by team for better organization
    const employeesByTeam = useMemo(() => {
        const grouped = new Map<string, typeof employees>();
        for (const emp of filteredEmployees) {
            const teamName = emp.team || "Unassigned";
            if (!grouped.has(teamName)) {
                grouped.set(teamName, []);
            }
            grouped.get(teamName)!.push(emp);
        }
        return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [filteredEmployees]);

    const handleLocate = (employeeId: Id<"employees">) => {
        setHighlightedEmployeeIds([employeeId]);
        // Close the dialog when locating
        onOpenChange(false);
        // Auto-clear highlight after 30 seconds
        setTimeout(() => {
            setHighlightedEmployeeIds(null);
        }, 30000);
    };

    const handleClearHighlight = () => {
        setHighlightedEmployeeIds(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Team Directory
                    </DialogTitle>
                    <DialogDescription>
                        Search and locate employees in your office
                    </DialogDescription>
                </DialogHeader>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, job title, or team..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Clear highlight button */}
                {highlightedEmployeeIds.size > 0 && (
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearHighlight}
                        >
                            Clear Highlight
                        </Button>
                    </div>
                )}

                {/* Employee List */}
                <div className="flex-1 overflow-y-auto mt-4 space-y-4">
                    {employeesByTeam.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No employees found</p>
                        </div>
                    ) : (
                        employeesByTeam.map(([teamName, teamEmployees]) => (
                            <div key={teamName} className="space-y-2">
                                <div className="flex items-center gap-2 px-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <h3 className="font-semibold text-sm text-muted-foreground">
                                        {teamName}
                                    </h3>
                                    <Badge variant="secondary" className="ml-auto">
                                        {teamEmployees.length}
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {teamEmployees.map((emp) => (
                                        <Card
                                            key={emp._id}
                                            className={cn(
                                                "transition-all hover:shadow-md",
                                                highlightedEmployeeIds.has(emp._id) &&
                                                "ring-2 ring-primary ring-offset-2"
                                            )}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            {emp.name}
                                                            {emp.isCEO && (
                                                                <Badge variant="default" className="text-xs">
                                                                    CEO
                                                                </Badge>
                                                            )}
                                                        </CardTitle>
                                                        {emp.jobTitle && (
                                                            <CardDescription className="flex items-center gap-2 mt-1">
                                                                <Briefcase className="h-3 w-3" />
                                                                {emp.jobTitle}
                                                            </CardDescription>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Users className="h-3 w-3" />
                                                        <span>{emp.team}</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleLocate(emp._id)}
                                                        className={cn(
                                                            "flex items-center gap-2",
                                                            highlightedEmployeeIds.has(emp._id) &&
                                                            "bg-primary text-primary-foreground"
                                                        )}
                                                    >
                                                        <MapPin className="h-3 w-3" />
                                                        {highlightedEmployeeIds.has(emp._id)
                                                            ? "Locating..."
                                                            : "Locate"}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Stats */}
                <div className="border-t pt-4 mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Showing {filteredEmployees.length} of {employees.length} employees
                    </span>
                    {highlightedEmployeeIds.size > 0 && (
                        <span className="text-primary">
                            {highlightedEmployeeIds.size === 1
                                ? "Employee highlighted in scene"
                                : `${highlightedEmployeeIds.size} employees highlighted in scene`}
                        </span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

