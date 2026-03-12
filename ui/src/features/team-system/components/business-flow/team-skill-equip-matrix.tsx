"use client";

/**
 * TEAM SKILL EQUIP MATRIX
 * =======================
 * Compact visibility card for business team members and equipped skills.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TeamSkillEquipRow {
  agentId: string;
  name: string;
  role: string;
  statusText: string;
  heartbeatState?: string;
  equippedSkills: string[];
}

function formatRole(role: string): string {
  if (role === "biz_pm") return "Business PM";
  if (role === "biz_executor") return "Business Executor";
  return role;
}

export function TeamSkillEquipMatrix({ rows }: { rows: TeamSkillEquipRow[] }): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Agent Skill Equip Matrix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No business PM/executor members found for this team.
          </p>
        ) : null}
        {rows.map((row) => (
          <div key={row.agentId} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRole(row.role)} · {row.agentId}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.heartbeatState ? <Badge variant="outline">{row.heartbeatState}</Badge> : null}
                <p className="text-xs text-muted-foreground">{row.statusText}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {row.equippedSkills.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No explicit skill allowlist set.
                </span>
              ) : (
                row.equippedSkills.map((skillId) => (
                  <Badge key={`${row.agentId}-${skillId}`} variant="secondary">
                    {skillId}
                  </Badge>
                ))
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
