import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Square, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSubmit: (message: { text: string }) => Promise<void>;
  onAbort?: () => Promise<void>;
  submissionStatus: "submitted" | "streaming" | "ready";
  isStreaming?: boolean;
  variant?: "classic" | "story";
}

export function ChatInput({
  onSubmit,
  onAbort,
  submissionStatus,
  isStreaming,
  variant = "classic",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const canSubmit = submissionStatus !== "streaming" && Boolean(text.trim());

  const submitMessage = async (): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || submissionStatus === "streaming") return;
    await onSubmit({ text: trimmed });
    setText("");
  };

  return (
    <div
      className={
        variant === "story"
          ? "border-t border-border/70 bg-background/95"
          : "border-t bg-background"
      }
    >
      <div
        className={`mx-auto px-4 py-4 ${variant === "story" ? "max-w-7xl" : "container max-w-4xl"}`}
      >
        <div className="flex items-end gap-2">
          <textarea
            className={
              variant === "story"
                ? "min-h-[68px] w-full border border-border/70 bg-background px-4 py-3 text-[12px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                : "min-h-20 w-full rounded-md border bg-background p-3 text-sm"
            }
            placeholder={
              variant === "story" ? "Write the next line..." : "Ask me to research something..."
            }
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              void submitMessage();
            }}
          />
          {isStreaming && onAbort ? (
            <Button
              variant="outline"
              onClick={() => void onAbort()}
              type="button"
              className={
                variant === "story"
                  ? "border-border/70 bg-background text-foreground hover:bg-muted"
                  : undefined
              }
            >
              <Square className="h-4 w-4 mr-1.5" />
              Stop
            </Button>
          ) : null}
          <Button
            onClick={() => void submitMessage()}
            disabled={!canSubmit}
            className={
              variant === "story"
                ? "border-border/70 bg-secondary text-secondary-foreground hover:bg-secondary/85"
                : undefined
            }
          >
            {submissionStatus === "streaming" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <Sparkles className="h-4 w-4" />
                Sending...
              </span>
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
