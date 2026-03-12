"use client";

/**
 * BUSINESS SKILL LIBRARY
 * ======================
 * Slot-targeted skill picker for assigning capability skills.
 *
 * KEY CONCEPTS:
 * - Keeps skill assignment explicit by active slot selection.
 * - Uses curated category groupings for fast operator choices.
 *
 * USAGE:
 * - Render beside `BusinessFlowComposer` and update builder draft on assign.
 *
 * MEMORY REFERENCES:
 * - MEM-0131
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type BusinessSlotKey = "measure" | "execute" | "distribute";

interface BusinessSkillLibraryProps {
  selectedSlot: BusinessSlotKey;
  onSelectSlot: (slot: BusinessSlotKey) => void;
  onToggleSkill: (slot: BusinessSlotKey, skillId: string) => void;
  currentSkills: Record<BusinessSlotKey, string>;
}

const SKILL_LIBRARY: Array<{ category: string; skills: string[] }> = [
  {
    category: "measure",
    skills: ["amazon-affiliate-metrics", "bitly-click-tracker", "stripe-revenue"],
  },
  {
    category: "execute",
    skills: ["video-generator", "article-writer", "landing-page-builder"],
  },
  {
    category: "distribute",
    skills: ["tiktok-poster", "youtube-shorts-poster", "reddit-poster"],
  },
  {
    category: "cross-cutting",
    skills: ["ledger-manager", "experiment-runner"],
  },
];

export function BusinessSkillLibrary({
  selectedSlot,
  onSelectSlot,
  onToggleSkill,
  currentSkills,
}: BusinessSkillLibraryProps): React.JSX.Element {
  const activeSkills: Record<BusinessSlotKey, Set<string>> = {
    measure: new Set(
      currentSkills.measure
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
    execute: new Set(
      currentSkills.execute
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
    distribute: new Set(
      currentSkills.distribute
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Skill Library</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["measure", "execute", "distribute"] as const).map((slot) => (
            <Button
              key={slot}
              size="sm"
              variant={selectedSlot === slot ? "secondary" : "outline"}
              onClick={() => onSelectSlot(slot)}
            >
              {slot}
            </Button>
          ))}
        </div>
        <div className="rounded-md border bg-muted/20 p-2 text-xs">
          Assigning to <span className="font-medium">{selectedSlot}</span>:{" "}
          <span className="text-muted-foreground">{currentSkills[selectedSlot] || "not-set"}</span>{" "}
          (multi-select)
        </div>
        <div className="space-y-3">
          {SKILL_LIBRARY.map((section) => (
            <div key={section.category} className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {section.category}
              </p>
              <div className="flex flex-wrap gap-2">
                {section.skills.map((skillId) => (
                  <button
                    key={skillId}
                    type="button"
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      (section.category === "measure" && activeSkills.measure.has(skillId)) ||
                      (section.category === "execute" && activeSkills.execute.has(skillId)) ||
                      (section.category === "distribute" && activeSkills.distribute.has(skillId))
                        ? "border-primary bg-primary/15 text-primary"
                        : "bg-background hover:bg-muted"
                    }`}
                    onClick={() => {
                      if (
                        section.category === "measure" ||
                        section.category === "execute" ||
                        section.category === "distribute"
                      ) {
                        onSelectSlot(section.category);
                        onToggleSkill(section.category, skillId);
                      }
                    }}
                  >
                    {skillId}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
