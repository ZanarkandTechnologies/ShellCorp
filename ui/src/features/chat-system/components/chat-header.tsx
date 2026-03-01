import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface ChatHeaderProps {
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    title?: string;
    subtitle?: string;
}

export function ChatHeader({ sidebarOpen, onToggleSidebar, title, subtitle }: ChatHeaderProps) {
    return (
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
            <div className="px-4 py-3 flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="h-8 w-8 p-0">
                    {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold">{title || "Chat"}</h1>
                    {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
                </div>
                <ThemeToggle />
            </div>
        </header>
    );
}

