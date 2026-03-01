import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
    onSubmit: (message: { text: string }) => Promise<void>;
    submissionStatus: "submitted" | "streaming" | "ready";
}

export function ChatInput({ onSubmit, submissionStatus }: ChatInputProps) {
    const [text, setText] = useState("");

    return (
        <div className="border-t bg-background">
            <div className="container max-w-4xl mx-auto px-4 py-4">
                <div className="flex items-end gap-2">
                    <textarea
                        className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                        placeholder="Ask me to research something..."
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                    />
                    <Button
                        onClick={async () => {
                            const trimmed = text.trim();
                            if (!trimmed) return;
                            await onSubmit({ text: trimmed });
                            setText("");
                        }}
                        disabled={submissionStatus === "streaming" || !text.trim()}
                    >
                        {submissionStatus === "streaming" ? "Sending..." : "Send"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

