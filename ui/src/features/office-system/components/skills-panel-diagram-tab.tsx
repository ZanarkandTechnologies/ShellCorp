/**
 * SKILLS PANEL DIAGRAM TAB
 * ========================
 * Renders Mermaid diagram preview and source for the selected skill.
 *
 * MEMORY REFERENCES:
 * - MEM-0166
 */

import type { ReactElement } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { SkillsPanelSelectionState } from "./skills-panel-types";

type Props = {
  selection: SkillsPanelSelectionState;
  diagramDocument: string | null;
};

export function SkillsPanelDiagramTab({
  selection,
  diagramDocument,
}: Props): ReactElement {
  const { selectedDetail } = selection;

  if (!selectedDetail) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select a runtime skill to inspect its files, diagram, demos, and controls.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0 rounded-md border p-4">
      {selectedDetail.mermaid ? (
        <div className="space-y-4">
          <iframe
            title={`${selectedDetail.displayName} diagram`}
            srcDoc={diagramDocument ?? undefined}
            className="h-[28rem] w-full rounded-md border bg-background"
          />
          <Textarea
            readOnly
            className="min-h-[20rem] font-mono text-xs"
            value={selectedDetail.mermaid}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No Mermaid diagram found in this skill package yet.
        </p>
      )}
    </ScrollArea>
  );
}
