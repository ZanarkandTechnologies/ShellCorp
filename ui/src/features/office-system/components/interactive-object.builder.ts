export function getBuilderClickAction(params: {
  isSelected: boolean;
  allowSettings: boolean;
}): "select" | "open-config" | "clear-selection" {
  const { isSelected, allowSettings } = params;
  if (!isSelected) return "select";
  return allowSettings ? "open-config" : "clear-selection";
}
