"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/app-store";
import { gatewayBase, stateBase } from "@/lib/gateway-config";
import { OpenClawAdapter } from "@/lib/openclaw-adapter";
import type { SkillItemModel } from "@/lib/openclaw-types";

function fmtTs(ts?: number): string {
  if (!ts) return "n/a";
  return new Date(ts).toLocaleString();
}

export function SkillsPanel() {
  const isOpen = useAppStore((state) => state.isSkillsPanelOpen);
  const setIsOpen = useAppStore((state) => state.setIsSkillsPanelOpen);
  const adapter = useMemo(() => new OpenClawAdapter(gatewayBase, stateBase), []);

  const [skills, setSkills] = useState<SkillItemModel[]>([]);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const unified = await adapter.getUnifiedOfficeModel();
        if (cancelled) return;
        setSkills(unified.skills);
      } catch (error) {
        if (!cancelled) setErrorText(error instanceof Error ? error.message : "skills_load_failed");
      }
    }
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [adapter, isOpen]);

  const sharedCount = skills.filter((skill) => skill.scope === "shared").length;
  const agentCount = skills.filter((skill) => skill.scope === "agent").length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="min-w-[70vw] max-w-none h-[90vh] overflow-hidden p-0 z-[1200]">
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

