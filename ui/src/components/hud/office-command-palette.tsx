"use client";

/**
 * OFFICE COMMAND PALETTE
 * ======================
 * Searchable office action launcher built from the shared office panel registry.
 *
 * KEY CONCEPTS:
 * - Renders grouped registry actions without introducing a second state path.
 * - Shortcut hints mirror the keyboard layer so QA and operators can discover commands.
 * - Sits above office panels so it can be used while other HUD surfaces are already open.
 *
 * USAGE:
 * - Mounted from `office-menu.tsx`.
 *
 * MEMORY REFERENCES:
 * - MEM-0220
 */

import type { ComponentProps } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UI_Z } from "@/lib/z-index";

import type { OfficeActionGroup, OfficePanelAction } from "./office-panel-registry";

type OfficeCommandPaletteProps = {
  actions: OfficePanelAction[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const GROUP_ORDER: OfficeActionGroup[] = ["panel", "action", "navigation"];

const GROUP_LABELS: Record<OfficeActionGroup, string> = {
  panel: "Panels",
  action: "Actions",
  navigation: "Navigation",
};

export function OfficeCommandPalette({
  actions,
  onOpenChange,
  open,
}: OfficeCommandPaletteProps) {
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    actions: actions.filter((action) => action.group === group && action.showInPalette !== false),
  })).filter((entry) => entry.actions.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-2xl"
        overlayClassName="bg-black/65"
        overlayStyle={{ zIndex: UI_Z.panelModal - 1 }}
        showCloseButton={false}
        style={{ zIndex: UI_Z.panelModal }}
      >
        <DialogTitle className="sr-only">Office Command Palette</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-item]_svg]:size-4">
          <CommandInput placeholder="Open a panel or run an office action..." />
          <CommandList className="max-h-[70vh]">
            <CommandEmpty className="py-8 text-sm text-muted-foreground">
              No office panel or action matched that search.
            </CommandEmpty>
            {grouped.map((entry, index) => (
              <div key={entry.group}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={GROUP_LABELS[entry.group]}>
                  {entry.actions.map((action) => (
                    <CommandItem
                      key={action.id}
                      disabled={action.disabled}
                      onSelect={() => {
                        action.perform();
                        onOpenChange(false);
                      }}
                      value={buildActionValue(action)}
                    >
                      <action.icon className="text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{action.label}</span>
                          {action.badge ? (
                            <span className="rounded-full border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                              {action.badge > 99 ? "99+" : action.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      {action.shortcut ? <CommandShortcut>{action.shortcut.label}</CommandShortcut> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function buildActionValue(action: OfficePanelAction): ComponentProps<typeof CommandItem>["value"] {
  return [action.label, action.description, ...action.keywords].join(" ");
}
