"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BusinessBuilderDraft, BusinessBuilderResourceDraft, BusinessTypeOption } from "@/lib/business-builder";
import { createBusinessBuilderDraft } from "@/lib/business-builder";

interface BusinessBuilderFormProps {
  value: BusinessBuilderDraft;
  onChange: (next: BusinessBuilderDraft) => void;
  disabled?: boolean;
}

const skillOptions = [
  "amazon-affiliate-metrics",
  "bitly-click-tracker",
  "stripe-revenue",
  "video-generator",
  "article-writer",
  "landing-page-builder",
  "tiktok-poster",
  "youtube-shorts-poster",
  "reddit-poster",
  "resource-cash-tracker",
  "resource-api-quota-tracker",
  "resource-distribution-tracker",
  "resource-custom-tracker",
];

function patchResource(
  resources: BusinessBuilderResourceDraft[],
  index: number,
  patch: Partial<BusinessBuilderResourceDraft>,
): BusinessBuilderResourceDraft[] {
  return resources.map((resource, resourceIndex) => (resourceIndex === index ? { ...resource, ...patch } : resource));
}

export function BusinessBuilderForm({ value, onChange, disabled = false }: BusinessBuilderFormProps): React.JSX.Element {
  const handleBusinessTypeChange = (nextType: BusinessTypeOption): void => {
    if (nextType === "none") {
      onChange(createBusinessBuilderDraft("none"));
      return;
    }
    const nextDraft = createBusinessBuilderDraft(nextType);
    onChange({
      ...nextDraft,
      capabilitySkills: value.businessType === nextType ? value.capabilitySkills : nextDraft.capabilitySkills,
      resources: value.businessType === nextType && value.resources.length > 0 ? value.resources : nextDraft.resources,
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label>Business Type</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={value.businessType}
            onChange={(event) => handleBusinessTypeChange(event.target.value as BusinessTypeOption)}
            disabled={disabled}
          >
            <option value="none">none (standard project team)</option>
            <option value="affiliate_marketing">affiliate_marketing</option>
            <option value="content_creator">content_creator</option>
            <option value="saas">saas</option>
            <option value="custom">custom</option>
          </select>
        </div>
        {value.businessType !== "none" ? (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => onChange(createBusinessBuilderDraft(value.businessType))}
          >
            Apply Preset Defaults
          </Button>
        ) : null}
      </div>

      {value.businessType !== "none" ? (
        <>
          <div className="space-y-2">
            <Label>Capability Slots</Label>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Measure</Label>
                <Input
                  list="skill-options"
                  value={value.capabilitySkills.measure}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      capabilitySkills: { ...value.capabilitySkills, measure: event.target.value },
                    })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Execute</Label>
                <Input
                  list="skill-options"
                  value={value.capabilitySkills.execute}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      capabilitySkills: { ...value.capabilitySkills, execute: event.target.value },
                    })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Distribute</Label>
                <Input
                  list="skill-options"
                  value={value.capabilitySkills.distribute}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      capabilitySkills: { ...value.capabilitySkills, distribute: event.target.value },
                    })
                  }
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Resources</Label>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...value,
                    resources: [
                      ...value.resources,
                      {
                        type: "custom",
                        name: "Custom Resource",
                        unit: "units",
                        remaining: 0,
                        limit: 0,
                        trackerSkillId: "resource-custom-tracker",
                        whenLow: "warn",
                      },
                    ],
                  })
                }
              >
                Add Custom Resource
              </Button>
            </div>
            <div className="space-y-2">
              {value.resources.map((resource, index) => (
                <div key={`${resource.type}-${index}`} className="rounded-md border p-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={resource.name}
                        onChange={(event) =>
                          onChange({ ...value, resources: patchResource(value.resources, index, { name: event.target.value }) })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={resource.type}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            resources: patchResource(value.resources, index, {
                              type: event.target.value as BusinessBuilderResourceDraft["type"],
                            }),
                          })
                        }
                        disabled={disabled}
                      >
                        <option value="cash_budget">cash_budget</option>
                        <option value="api_quota">api_quota</option>
                        <option value="distribution_slots">distribution_slots</option>
                        <option value="custom">custom</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Remaining</Label>
                      <Input
                        type="number"
                        value={resource.remaining}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            resources: patchResource(value.resources, index, {
                              remaining: Number(event.target.value || "0"),
                            }),
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Limit</Label>
                      <Input
                        type="number"
                        value={resource.limit}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            resources: patchResource(value.resources, index, { limit: Number(event.target.value || "0") }),
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Input
                        value={resource.unit}
                        onChange={(event) =>
                          onChange({ ...value, resources: patchResource(value.resources, index, { unit: event.target.value }) })
                        }
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tracker Skill</Label>
                      <Input
                        list="skill-options"
                        value={resource.trackerSkillId}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            resources: patchResource(value.resources, index, { trackerSkillId: event.target.value }),
                          })
                        }
                        disabled={disabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <datalist id="skill-options">
            {skillOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </>
      ) : null}
    </div>
  );
}
