/**
 * SKILLS PANEL FILES TAB
 * ======================
 * Renders skill package file browsing and inline text editing.
 *
 * MEMORY REFERENCES:
 * - MEM-0166
 * - MEM-0205
 */

import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { SkillsPanelFileState, SkillsPanelSelectionState } from "./skills-panel-types";

type Props = {
  selection: SkillsPanelSelectionState;
  fileState: SkillsPanelFileState;
  onSelectFilePath: (path: string) => void;
  onChangeFileDraft: (value: string) => void;
  onSaveFile: () => void;
};

export function SkillsPanelFilesTab({
  selection,
  fileState,
  onSelectFilePath,
  onChangeFileDraft,
  onSaveFile,
}: Props): ReactElement {
  const { selectedDetail } = selection;
  const { selectedFilePath, selectedFile, fileDraft, fileSaveStatus, isSavingFile } = fileState;

  if (!selectedDetail) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Select a runtime skill to inspect its files, diagram, demos, and controls.
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[260px_minmax(0,1fr)] gap-4">
      <ScrollArea className="h-full min-h-0 rounded-md border">
        <div className="space-y-1 p-2">
          {selectedDetail.fileEntries.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFilePath(file.path)}
              className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedFilePath === file.path ? "bg-primary/10 text-primary" : "hover:bg-muted/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{file.path}</span>
                <Badge variant="outline">{file.kind}</Badge>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
      <ScrollArea className="h-full min-h-0 rounded-md border">
        <div className="min-h-full p-4">
          {!selectedFile ? (
            <p className="text-sm text-muted-foreground">Select a file to preview it.</p>
          ) : !selectedFile.isText ? (
            <p className="text-sm text-muted-foreground">
              Binary or non-text asset. Size: {selectedFile.sizeBytes ?? 0} bytes.
            </p>
          ) : selectedFile.writable === false ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                This file is read-only from the viewer.
              </p>
              <pre className="whitespace-pre-wrap break-words text-xs leading-6">
                {selectedFile.content}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={onSaveFile} disabled={isSavingFile}>
                  {isSavingFile ? "Saving..." : "Save file"}
                </Button>
                {fileSaveStatus ? (
                  <span className="text-xs text-muted-foreground">{fileSaveStatus}</span>
                ) : null}
              </div>
              <Textarea
                className="min-h-[32rem] font-mono text-xs"
                value={fileDraft}
                onChange={(event) => onChangeFileDraft(event.target.value)}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
