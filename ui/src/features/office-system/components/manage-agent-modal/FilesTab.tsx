"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AgentFileEntry, AgentsFilesListResult } from "@/lib/openclaw-types";

type FilesState = {
  list: AgentsFilesListResult | null;
  activeName: string | null;
  baseByName: Record<string, string>;
  draftByName: Record<string, string>;
  loading: boolean;
  saving: boolean;
  error: string;
};

type FilesPanelProps = {
  state: FilesState;
  setState: React.Dispatch<React.SetStateAction<FilesState>>;
  activeFile: AgentFileEntry | null;
  activeFileDraft: string;
  isActiveFileDirty: boolean;
  onSaveFile: () => Promise<void>;
  onRefreshFiles: () => Promise<void>;
};

export function FilesPanel(props: FilesPanelProps): JSX.Element {
  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Core workspace files (`AGENTS.md`, `IDENTITY.md`, `HEARTBEAT.md`, etc.) are loaded from OpenClaw.
        </p>
        <Button size="sm" variant="outline" onClick={() => void props.onRefreshFiles()} disabled={props.state.loading}>
          {props.state.loading ? "Loading..." : "Refresh"}
        </Button>
      </div>
      {props.state.list ? <p className="text-xs text-muted-foreground">Workspace: {props.state.list.workspace}</p> : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
        <div className="rounded-md border p-2 space-y-1 max-h-[46vh] overflow-auto">
          {(props.state.list?.files ?? []).map((file) => (
            <button
              key={file.name}
              className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                props.state.activeName === file.name ? "bg-accent" : ""
              }`}
              onClick={() => props.setState((current) => ({ ...current, activeName: file.name }))}
            >
              {file.name}
            </button>
          ))}
          {(props.state.list?.files.length ?? 0) === 0 ? <p className="text-xs text-muted-foreground">No files loaded.</p> : null}
        </div>
        <div className="space-y-2">
          {props.activeFile ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  <span className="text-muted-foreground">Editing:</span> {props.activeFile.name}
                </p>
                <Button size="sm" onClick={() => void props.onSaveFile()} disabled={!props.isActiveFileDirty || props.state.saving}>
                  {props.state.saving ? "Saving..." : "Save File"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{props.activeFile.path}</p>
                {props.activeFile.missing ? <Badge variant="secondary">missing</Badge> : null}
              </div>
              <Textarea
                value={props.activeFileDraft}
                onChange={(event) =>
                  props.setState((current) => ({
                    ...current,
                    draftByName: { ...current.draftByName, [props.activeFile!.name]: event.target.value },
                  }))
                }
                className="min-h-[42vh] font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!props.isActiveFileDirty}
                  onClick={() =>
                    props.setState((current) => ({
                      ...current,
                      draftByName: { ...current.draftByName, [props.activeFile!.name]: current.baseByName[props.activeFile!.name] ?? "" },
                    }))
                  }
                >
                  Reset
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a file to edit.</p>
          )}
        </div>
      </div>
      {props.state.loading ? <p className="text-xs text-muted-foreground">Loading files...</p> : null}
      {props.state.error ? <p className="text-xs text-destructive">{props.state.error}</p> : null}
    </div>
  );
}
