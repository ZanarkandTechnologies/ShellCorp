/**
 * USER TASKS PANEL
 * =================
 *
 * Notification panel for displaying and responding to pending user tasks.
 * Shows all tasks created by agents via the askUser tool.
 *
 * KEY CONCEPTS:
 * - Displays pending user tasks grouped by employee
 * - Minimal timeline-style layout matching view-computer-dialog aesthetic
 * - Real-time updates via Convex queries
 *
 * USAGE:
 * - Used by the OfficeMenu speed dial "User Tasks" button
 */

"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Bell,
    Check,
    X,
    MessageCircleQuestion,
    ShieldCheck,
    FileSearch,
    KeyRound,
    AlertTriangle,
} from "lucide-react";
import { Loader } from "@/components/ai-elements/loader";
import { formatDistanceToNow } from "date-fns";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface UserTasksPanelProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof MessageCircleQuestion; color: string }> = {
    approval: { icon: ShieldCheck, color: "text-amber-500" },
    question: { icon: MessageCircleQuestion, color: "text-blue-500" },
    review: { icon: FileSearch, color: "text-purple-500" },
    permission: { icon: KeyRound, color: "text-orange-500" },
    task_completed: { icon: Check, color: "text-green-500" },
    rate_alert: { icon: AlertTriangle, color: "text-red-500" },
    vm_creation_approval: { icon: ShieldCheck, color: "text-cyan-500" },
};

interface UserTask {
    _id: Id<"userTasks">;
    threadId: string;
    employeeId: Id<"employees">;
    userId: string;
    message: string;
    type: string;
    context: string;
    status: "pending" | "responded" | "cancelled";
    priority?: 1 | 2 | 3;
    response?: string;
    respondedAt?: number;
    createdAt: number;
}

interface TaskItemProps {
    task: UserTask;
    onRespond: (taskId: Id<"userTasks">, approved: boolean) => Promise<void>;
    isResponding: boolean;
}

function TaskItem({ task, onRespond, isResponding }: TaskItemProps) {
    const config = TYPE_CONFIG[task.type] || TYPE_CONFIG.question;
    const Icon = config.icon;

    return (
        <div className="pl-4 border-l-2 border-muted relative py-3 hover:bg-muted/30 transition-colors">
            {/* Timeline dot */}
            <div className="absolute -left-[5px] top-4 w-2 h-2 rounded-full bg-muted-foreground/40" />

            <div className="flex items-start gap-3">
                {/* Type icon */}
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm leading-snug">{task.message}</p>
                    {task.context && (
                        <p className="text-xs text-muted-foreground">{task.context}</p>
                    )}
                </div>

                {/* Time + Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                        {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                    </span>

                    {task.status === "pending" && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                onClick={() => onRespond(task._id, false)}
                                disabled={isResponding}
                                title="Deny"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-green-500 hover:bg-green-500/10"
                                onClick={() => onRespond(task._id, true)}
                                disabled={isResponding}
                                title="Approve"
                            >
                                <Check className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}

                    {task.status === "responded" && (
                        <Badge variant="outline" className="h-5 text-[10px] px-1.5 bg-green-500/10 text-green-600 border-green-500/20">
                            Done
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
}

export function UserTasksPanel({ isOpen, onOpenChange }: UserTasksPanelProps) {
    const { userId } = useAuth();
    const [respondingTaskId, setRespondingTaskId] = useState<Id<"userTasks"> | null>(null);

    const pendingTasks = useQuery(
        api.user_system.user_tasks.getAllPendingUserTasks,
        userId ? { userId } : "skip"
    ) as UserTask[] | undefined;

    const companyData = useQuery(
        api.office_system.companies.getCompany,
        { fetchEmployees: true }
    );

    const respondMutation = useMutation(api.user_system.user_tasks.respondToUserTask);

    const handleRespond = async (taskId: Id<"userTasks">, approved: boolean) => {
        setRespondingTaskId(taskId);
        try {
            await respondMutation({ userTaskId: taskId, approved });
        } finally {
            setRespondingTaskId(null);
        }
    };

    // Group tasks by employee, sorted by most recent
    const tasksByEmployee = useMemo(() => {
        if (!pendingTasks || !companyData) return [];

        const groups: Record<string, { employee: any; tasks: UserTask[]; latestTaskAt: number }> = {};
        const getEmployee = (id: string) => companyData.employees.find(e => e._id === id);

        pendingTasks.forEach(task => {
            const empId = task.employeeId as string;
            if (!groups[empId]) {
                groups[empId] = { employee: getEmployee(empId), tasks: [], latestTaskAt: 0 };
            }
            groups[empId].tasks.push(task);
            if (task.createdAt > groups[empId].latestTaskAt) {
                groups[empId].latestTaskAt = task.createdAt;
            }
        });

        return Object.values(groups)
            .map(g => ({ ...g, tasks: g.tasks.sort((a, b) => b.createdAt - a.createdAt) }))
            .sort((a, b) => b.latestTaskAt - a.latestTaskAt);
    }, [pendingTasks, companyData]);

    const isLoading = pendingTasks === undefined || companyData === undefined;
    const taskCount = pendingTasks?.length ?? 0;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[80vh] p-0 gap-0 z-[1000] flex flex-col">
                {/* Header */}
                <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0 bg-muted/20 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Bell className="h-4 w-4 text-primary" />
                        Inbox
                    </DialogTitle>
                    {taskCount > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                            {taskCount} pending
                        </Badge>
                    )}
                </DialogHeader>

                {/* Content */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader size={20} />
                                <p className="text-xs text-muted-foreground mt-2">Loading...</p>
                            </div>
                        ) : taskCount === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                                    <Check className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium">All clear</p>
                                <p className="text-xs text-muted-foreground mt-1">No pending requests</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {tasksByEmployee.map(({ employee, tasks }) => (
                                    <div key={employee?._id || 'unknown'}>
                                        {/* Employee Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={employee?.profileImageUrl} />
                                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                    {employee?.name?.charAt(0) || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-medium">{employee?.name || "Unknown"}</span>
                                            <span className="text-[10px] text-muted-foreground">· {employee?.jobTitle || "Employee"}</span>
                                            <Badge variant="secondary" className="ml-auto h-4 text-[10px] px-1">
                                                {tasks.length}
                                            </Badge>
                                        </div>

                                        {/* Tasks */}
                                        <div className="ml-3">
                                            {tasks.map((task) => (
                                                <TaskItem
                                                    key={task._id}
                                                    task={task}
                                                    onRespond={handleRespond}
                                                    isResponding={respondingTaskId === task._id}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
