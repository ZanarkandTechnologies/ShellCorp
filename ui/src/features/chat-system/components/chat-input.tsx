import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Square, Sparkles } from "lucide-react";

interface ChatInputProps {
    onSubmit: (message: { text: string }) => Promise<void>;
    onAbort?: () => Promise<void>;
    submissionStatus: "submitted" | "streaming" | "ready";
    isStreaming?: boolean;
}

export function ChatInput({ onSubmit, onAbort, submissionStatus, isStreaming }: ChatInputProps) {
    const [text, setText] = useState("");
    const canSubmit = submissionStatus !== "streaming" && Boolean(text.trim());

    const submitMessage = async (): Promise<void> => {
        const trimmed = text.trim();
        if (!trimmed || submissionStatus === "streaming") return;
        await onSubmit({ text: trimmed });
        setText("");
    };

    return (
        <div className="border-t bg-background">
            <div className="container max-w-4xl mx-auto px-4 py-4">
                <div className="flex items-end gap-2">
                    <textarea
                        className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                        placeholder="Ask me to research something..."
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.shiftKey) return;
                            event.preventDefault();
                            void submitMessage();
                        }}
                    />
                    {isStreaming && onAbort ? (
                        <Button variant="outline" onClick={() => void onAbort()} type="button">
                            <Square className="h-4 w-4 mr-1.5" />
                            Stop
                        </Button>
                    ) : null}
                    <Button onClick={() => void submitMessage()} disabled={!canSubmit}>
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
