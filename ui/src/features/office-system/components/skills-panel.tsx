"use client";

import { useMemo, useState } from "react";
import { usePollWithInterval } from "@/hooks/use-poll-with-interval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/app-store";
import type { SkillItemModel } from "@/lib/openclaw-types";
import { useOpenClawAdapter } from "@/providers/openclaw-adapter-provider";
import { UI_Z } from "@/lib/z-index";
import { formatTimestamp as fmtTs } from "@/lib/format-utils";

export function SkillsPanel() {
  const isOpen = useAppStore((state) => state.isSkillsPanelOpen);
  const setIsOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const adapter = useOpenClawAdapter();

  const [skills, setSkills] = useState<SkillItemModel[]>([]);
  const [errorText, setErrorText] = useState("");

  usePollWithInterval(
    async (signal) => {
      if (!isOpen) return;
      try {
        const unified = await adapter.getUnifiedOfficeModel();
        if (signal.cancelled) return;
        setSkills(unified.skills);
      } catch (error) {
        if (!signal.cancelled) setErrorText(error instanceof Error ? error.message : "skills_load_failed");
      }
    },
    10000,
    [adapter, isOpen],
  );

  const sharedCount = skills.filter((skill) => skill.scope === "shared").length;
  const agentCount = skills.filter((skill) => skill.scope === "agent").length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0" style={{ zIndex: UI_Z.panelElevated }}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Skills Panel</DialogTitle>
          {errorText ? <p className="text-xs text-destructive">{errorText}</p> : null}
        </DialogHeader>

        <div className="h-full overflow-hidden px-6 pb-6">
          <div className="mb-3 mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All Skills</CardTitle>
              </CardHeader>
              <CardContent>{skills.length}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Shared</CardTitle>
              </CardHeader>
              <CardContent>{sharedCount}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Per-Agent</CardTitle>
              </CardHeader>
              <CardContent>{agentCount}</CardContent>
            </Card>
          </div>

          <ScrollArea className="h-[64vh] rounded-md border">
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="p-2">Name</th>
                    <th className="p-2">Category</th>
                    <th className="p-2">Scope</th>
                    <th className="p-2">Source</th>
                    <th className="p-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((skill) => (
                    <tr key={`${skill.scope}-${skill.name}-${skill.sourcePath}`}>
                      <td className="p-2">{skill.name}</td>
                      <td className="p-2">{skill.category}</td>
                      <td className="p-2">{skill.scope}</td>
                      <td className="p-2">{skill.sourcePath || "n/a"}</td>
                      <td className="p-2">{fmtTs(skill.updatedAt)}</td>
                    </tr>
                  ))}
                  {skills.length === 0 ? (
                    <tr>
                      <td className="p-2 text-muted-foreground" colSpan={5}>
                        No skills loaded.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

