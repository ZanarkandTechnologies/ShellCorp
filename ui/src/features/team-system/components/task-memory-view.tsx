"use client";

/**
 * TASK MEMORY VIEW
 * ================
 * Shared rendered view for compact SC12 task memory notes.
 *
 * KEY CONCEPTS:
 * - Renders markdown-ish task notes as readable sections instead of raw text blobs.
 * - Works in compact cards and full detail views so SC12 memory looks consistent across the UI.
 *
 * USAGE:
 * - Mounted inside CEO Workbench, User Tasks, and Task Detail modal.
 *
 * MEMORY REFERENCES:
 * - MEM-0155
 * - MEM-0160
 */

import { Badge } from "@/components/ui/badge";
import { parseTaskMemory } from "@/lib/sc12-task-memory";

type TaskMemoryViewProps = {
  notes?: string;
  variant?: "compact" | "full";
};

function renderLinkedText(text: string, interactive: boolean): JSX.Element[] {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part, index) => {
      if (interactive && /^https?:\/\//.test(part)) {
        const href = part.replace(/[.,;:!?]+$/, "");
        const suffix = part.slice(href.length);
        return (
          <span key={`${part}-${index}`}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {href}
            </a>
            {suffix}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
}

export function TaskMemoryView({ notes, variant = "full" }: TaskMemoryViewProps): JSX.Element {
  const parsed = parseTaskMemory(notes);
  const interactiveLinks = variant === "full";
  const goalSection = parsed.sections.find((section) => section.title === "Goal") ?? null;
  const sections =
    variant === "compact"
      ? parsed.sections
          .filter((section) => section.title !== "Goal")
          .slice(0, 2)
          .map((section) => ({
            ...section,
            paragraphs: section.paragraphs.slice(0, 1),
            bullets: section.bullets.slice(0, 2),
          }))
      : parsed.sections.filter((section) => section.title !== "Goal");

  if (parsed.sections.length === 0) {
    return (
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        No task memory yet.
      </p>
    );
  }

  return (
    <div className={variant === "compact" ? "space-y-2" : "space-y-4"}>
      {goalSection && variant === "full" ? (
        <section className="border border-border bg-card p-5">
          {goalSection.paragraphs.map((paragraph, index) => (
            <p
              key={`goal-${index}`}
              className={
                variant === "full"
                  ? "max-w-4xl text-2xl leading-tight tracking-tight text-foreground"
                  : "text-sm leading-6 text-foreground"
              }
            >
              {renderLinkedText(paragraph, interactiveLinks)}
            </p>
          ))}
        </section>
      ) : null}
      {sections.map((section, sectionIndex) => (
        <section
          key={`${section.title}-${sectionIndex}`}
          className={
            variant === "compact"
              ? "space-y-2 border border-border bg-card p-3"
              : "border border-border bg-card p-5"
          }
        >
          {variant === "full" ? (
            <div className="mb-3 flex items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-none border-border bg-background text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
              >
                {section.title}
              </Badge>
            </div>
          ) : null}
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p
              key={`${section.title}-p-${paragraphIndex}`}
              className={
                variant === "compact"
                  ? "text-xs leading-5 text-muted-foreground"
                  : "text-sm leading-7 text-foreground"
              }
            >
              {renderLinkedText(paragraph, interactiveLinks)}
            </p>
          ))}
          {section.bullets.length > 0 ? (
            <ul
              className={
                variant === "compact"
                  ? "space-y-1 text-xs text-muted-foreground"
                  : "space-y-2 text-sm text-muted-foreground"
              }
            >
              {section.bullets.map((bullet, bulletIndex) => (
                <li key={`${section.title}-b-${bulletIndex}`} className="flex gap-3">
                  <span className="mt-[0.55rem] h-1.5 w-1.5 bg-foreground/40" />
                  <span>{renderLinkedText(bullet, interactiveLinks)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      {variant === "compact" && parsed.sections.length > sections.length ? (
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Open for full brief
        </p>
      ) : null}
    </div>
  );
}
