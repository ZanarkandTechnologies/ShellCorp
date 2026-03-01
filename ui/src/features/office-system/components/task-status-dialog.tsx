"use client";

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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, Info, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/app-store";

function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export function TaskStatusDialog() {
    const taskStatusEmployeeId = useAppStore((state) => state.taskStatusEmployeeId);
    const setTaskStatusEmployeeId = useAppStore((state) => state.setTaskStatusEmployeeId);

    const isOpen = taskStatusEmployeeId !== null;
    const employeeId = taskStatusEmployeeId;

    const handleClose = (open: boolean) => {
        if (!open) {
            setTaskStatusEmployeeId(null);
        }
    };

    const employee = useQuery(
        api.office_system.employees.getEmployee,
        employeeId ? { employeeId } : "skip"
    );

    const tasks = useQuery(
        api.user_system.user_tasks.getPendingNotificationsByEmployee,
        employeeId ? { employeeId } : "skip"
    );

    const dismissAll = useMutation(api.user_system.user_tasks.dismissEmployeeNotifications);
    const dismissTask = useMutation(api.user_system.user_tasks.dismissUserTask);

    const handleDismissAll = async () => {
        if (employeeId) {
            await dismissAll({ employeeId });
            handleClose(false);
        }
    };

    const handleDismissTask = async (taskId: Id<"userTasks">) => {
        await dismissTask({ userTaskId: taskId });
    };

    // Helper to get icon based on priority/type
    const getTaskIcon = (type: string, priority: number) => {
        if (priority === 3) return <AlertCircle className="h-4 w-4 text-red-500" />;
        if (priority === 2) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
        if (type === "task_completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
        return <Info className="h-4 w-4 text-blue-500" />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>{employee?.name || "Agent"} - Tasks & Status</span>
                        {tasks && tasks.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                                {tasks.length} Pending
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Review pending notifications and tasks from this agent.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden min-h-[300px]">
                    {tasks === undefined ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            Loading tasks...
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                            <CheckCircle2 className="h-8 w-8 opacity-20" />
                            <p>No pending tasks or notifications.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full pr-4">
                            <div className="space-y-3 p-1">
                                {tasks.map((task) => (
                                    <div
                                        key={task._id}
                                        className="flex flex-col gap-2 p-3 rounded-lg border bg-card text-card-foreground shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2">
                                                <div className="mt-1">
                                                    {getTaskIcon(task.type, task.priority ?? 1)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-sm flex items-center gap-2">
                                                        {task.message}
                                                        {task.priority === 3 && (
                                                            <Badge variant="destructive" className="h-5 text-[10px] px-1">
                                                                CRITICAL
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {task.context}
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                onClick={() => handleDismissTask(task._id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground pl-6">
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span>{timeAgo(task.createdAt)}</span>
                                            </div>
                                            <div className="capitalize bg-muted px-1.5 py-0.5 rounded">
                                                {task.type.replace('_', ' ')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-2 border-t">
                    <Button variant="outline" onClick={() => handleClose(false)}>
                        Close
                    </Button>
                    {tasks && tasks.length > 0 && (
                        <Button onClick={handleDismissAll}>
                            Dismiss All
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

