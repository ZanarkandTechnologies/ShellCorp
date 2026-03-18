/**
 * SKILLS PANEL DEMOS TAB
 * ======================
 * Renders markdown-backed demo cases and their execution results.
 *
 * MEMORY REFERENCES:
 * - MEM-0166
 */

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SkillDemoRunResult } from "@/lib/openclaw-types";
import type { SkillsPanelDemoState, SkillsPanelSelectionState } from "./skills-panel-types";

type Props = {
  selection: SkillsPanelSelectionState;
  demoState: SkillsPanelDemoState;
  selectedDemoTitle: string | null;
  getDemoStepKey: (
    caseId: string,
    step: SkillDemoRunResult["steps"][number],
    index: number,
  ) => string;
  onSelectDemoId: (demoId: string) => void;
  onRunDemo: () => void;
};

export function SkillsPanelDemosTab({
  selection,
  demoState,
  selectedDemoTitle,
  getDemoStepKey,
  onSelectDemoId,
  onRunDemo,
}: Props): ReactElement {
  const { selectedDetail } = selection;
  const { selectedDemoId, lastDemoRun, isRunningDemo } = demoState;

  if (!selectedDetail) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select a runtime skill to inspect its files, diagram, demos, and controls.
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)] gap-4">
      <ScrollArea className="h-full min-h-0 rounded-md border">
        <div className="space-y-2 p-2">
          {selectedDetail.demoCases.map((demo) => (
            <button
              key={demo.id}
              type="button"
              onClick={() => onSelectDemoId(demo.id)}
              className={`w-full rounded-md border p-3 text-left ${selectedDemoId === demo.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
            >
              <p className="font-medium">{demo.title}</p>
              <p className="text-xs text-muted-foreground">{demo.relativePath}</p>
              <p className="mt-1 text-xs text-muted-foreground">{demo.stepCount} step(s)</p>
            </button>
          ))}
          {selectedDetail.demoCases.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              No demo cases found under `tests/*.md`.
            </p>
          ) : null}
        </div>
      </ScrollArea>
      <ScrollArea className="h-full min-h-0 rounded-md border">
        <div className="min-h-full space-y-4 p-4">
          <div className="flex items-center gap-2">
            <Button onClick={onRunDemo} disabled={!selectedDemoTitle || isRunningDemo}>
              {isRunningDemo ? "Running..." : "Run saved case"}
            </Button>
            {selectedDemoTitle ? (
              <p className="text-sm text-muted-foreground">{selectedDemoTitle}</p>
            ) : null}
          </div>
          {!lastDemoRun ? (
            <p className="text-sm text-muted-foreground">
              Run a saved markdown demo case to inspect stdout, assertions, and step-by-step
              results.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={lastDemoRun.passed ? "secondary" : "destructive"}>
                  {lastDemoRun.passed ? "passed" : "failed"}
                </Badge>
                <Badge variant="outline">{lastDemoRun.durationMs} ms</Badge>
              </div>
              {lastDemoRun.steps.map((step, index) => (
                <Card key={getDemoStepKey(lastDemoRun.caseId, step, index)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Step {index + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-2">
                      {step.run.join(" ")}
                    </pre>
                    {step.stdout ? (
                      <pre className="whitespace-pre-wrap break-words rounded bg-muted/30 p-2">
                        {step.stdout}
                      </pre>
                    ) : null}
                    {step.stderr ? (
                      <pre className="whitespace-pre-wrap break-words rounded bg-destructive/10 p-2">
                        {step.stderr}
                      </pre>
                    ) : null}
                    {step.failures.length > 0 ? (
                      <pre className="whitespace-pre-wrap break-words rounded bg-destructive/10 p-2">
                        {step.failures.join("\n")}
                      </pre>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
