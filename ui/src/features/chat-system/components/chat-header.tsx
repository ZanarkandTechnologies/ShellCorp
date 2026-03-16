import { Button } from "@/components/ui/button";
import type { ChatPresentationMode } from "@/features/chat-system/chat-store";
import { Clapperboard, Menu, X, Wrench } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface ChatHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  title?: string;
  subtitle?: string;
  showWorkingOutput?: boolean;
  onToggleWorkingOutput?: () => void;
  presentationMode?: ChatPresentationMode;
  onTogglePresentationMode?: () => void;
  storyMode?: boolean;
  onClose?: () => void;
}

export function ChatHeader({
  sidebarOpen,
  onToggleSidebar,
  title,
  subtitle,
  showWorkingOutput = false,
  onToggleWorkingOutput,
  presentationMode = "classic",
  onTogglePresentationMode,
  storyMode = false,
  onClose,
}: ChatHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-10 border-b ${storyMode ? "border-border/70 bg-background/95 text-foreground" : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"}`}
    >
      <div className="px-4 py-3 flex items-center gap-4">
        {!storyMode ? (
          <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="h-8 w-8 p-0">
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        ) : null}
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{title || "Chat"}</h1>
          {subtitle ? (
            <p
              className={`text-xs ${storyMode ? "text-muted-foreground" : "text-muted-foreground"}`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {onTogglePresentationMode ? (
          <Button
            variant={presentationMode === "story" ? "default" : "outline"}
            size="sm"
            onClick={onTogglePresentationMode}
            className={`h-8 gap-1.5 ${storyMode ? "border-border/70 bg-background text-foreground hover:bg-muted" : ""}`}
          >
            <Clapperboard className="h-3.5 w-3.5" />
            {presentationMode === "story" ? "Story mode on" : "Story mode"}
          </Button>
        ) : null}
        {onToggleWorkingOutput ? (
          <Button
            variant={showWorkingOutput ? "default" : "outline"}
            size="sm"
            onClick={onToggleWorkingOutput}
            className={`h-8 gap-1.5 ${storyMode ? "border-border/70 bg-background text-foreground hover:bg-muted" : ""}`}
          >
            <Wrench className="h-3.5 w-3.5" />
            {showWorkingOutput ? "Hide working output" : "Show working output"}
          </Button>
        ) : null}
        {storyMode && onClose ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 border-border/70 bg-background text-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
