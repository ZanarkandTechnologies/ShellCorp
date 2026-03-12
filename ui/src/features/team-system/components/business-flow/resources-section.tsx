"use client";

/**
 * BUSINESS RESOURCES SECTION
 * ==========================
 * Read-only overview of advisory project resources.
 *
 * KEY CONCEPTS:
 * - Mirrors canonical `project.resources[]` values.
 * - Keeps mutations CLI-first (`team resources *` commands).
 *
 * USAGE:
 * - Render in Business tab below capability composer.
 *
 * MEMORY REFERENCES:
 * - MEM-0122
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectResourceModel } from "@/lib/openclaw-types";

interface ResourcesSectionProps {
  resources: ProjectResourceModel[];
}

export function ResourcesSection({ resources }: ResourcesSectionProps): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resources</CardTitle>
      </CardHeader>
      <CardContent>
        <details open className="space-y-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Tracked resources ({resources.length})
          </summary>
          <div className="space-y-2 text-sm">
            {resources.map((resource) => (
              <div key={resource.id} className="rounded-md border bg-muted/10 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{resource.name}</p>
                  <p className="text-xs text-muted-foreground">{resource.type}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {resource.remaining}/{resource.limit} {resource.unit}
                  {typeof resource.reserved === "number" ? ` | reserved=${resource.reserved}` : ""}
                  {` | whenLow=${resource.policy.whenLow}`}
                </p>
              </div>
            ))}
            {resources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No resources configured yet.</p>
            ) : null}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
