"use client";

/**
 * BUSINESS READINESS PANEL
 * ========================
 * Displays slot/resource readiness issues before business execution.
 *
 * KEY CONCEPTS:
 * - Uses builder-derived issues and team-level readiness overrides.
 *
 * USAGE:
 * - Render in Team Panel Business tab below flow composer controls.
 *
 * MEMORY REFERENCES:
 * - MEM-0131
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessReadinessIssue } from "@/lib/business-builder";

interface BusinessReadinessPanelProps {
  issues: BusinessReadinessIssue[];
  fallbackReady?: boolean;
}

export function BusinessReadinessPanel({
  issues,
  fallbackReady = false,
}: BusinessReadinessPanelProps): React.JSX.Element {
  const ready = issues.length === 0 || fallbackReady;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Readiness Checklist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {issues.map((issue) => (
          <p key={issue.code} className="text-amber-500">
            - {issue.message}
          </p>
        ))}
        {ready ? <p className="text-emerald-500">Ready to run.</p> : null}
      </CardContent>
    </Card>
  );
}
