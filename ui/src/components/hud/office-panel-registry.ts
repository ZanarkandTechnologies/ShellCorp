"use client";

/**
 * OFFICE PANEL REGISTRY
 * =====================
 * Shared registry for the office's global panel launchers, shortcuts, and QA hooks.
 *
 * KEY CONCEPTS:
 * - One source of truth for menu items, command-palette actions, and keyboard shortcuts.
 * - Registry actions must call the same real UI state paths used by the HUD.
 * - Dev-only QA helpers may call this registry, but they must not bypass normal panel logic.
 *
 * USAGE:
 * - Built by `office-menu.tsx` and consumed by the speed-dial, command palette, and dev QA bridge.
 *
 * MEMORY REFERENCES:
 * - MEM-0220
 */

import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Hammer,
  Home,
  MessageSquare,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { CeoWorkbenchView } from "@/lib/app-store";

const SECONDARY_BUTTON_COLOR = "bg-secondary hover:bg-secondary/80 text-secondary-foreground";
const EMPHASIZED_BUTTON_COLOR = "bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30";
const GUIDED_BUTTON_CLASS =
  "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse";

export type OfficeShortcut = {
  key: string;
  label: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  metaOrCtrlKey?: boolean;
  shiftKey?: boolean;
};

export type OfficeActionGroup = "navigation" | "panel" | "action";

export type OfficePanelActionId =
  | "back-landing"
  | "organization"
  | "team-workspace"
  | "agent-session"
  | "global-skills"
  | "ceo-chat"
  | "ceo-workbench"
  | "human-review"
  | "builder-mode"
  | "office-shop"
  | "settings";

export type OfficePanelAction = {
  id: OfficePanelActionId;
  label: string;
  description: string;
  group: OfficeActionGroup;
  icon: LucideIcon;
  keywords: string[];
  shortcut?: OfficeShortcut;
  badge?: number;
  color: string;
  disabled?: boolean;
  buttonClassName?: string;
  showInMenu?: boolean;
  showInPalette?: boolean;
  perform: () => void;
};

export type OfficePanelRegistryDependencies = {
  highlightedMenuActionId: string | null;
  isAnimatingCamera: boolean;
  isBuilderMode: boolean;
  navigateToLanding: () => void;
  openAgentSession: () => void;
  openCeoChat: () => void;
  openCeoWorkbench: (view: CeoWorkbenchView) => void;
  openDecoration: () => void;
  openGlobalSkills: () => void;
  openGlobalTeamWorkspace: () => void;
  openOrganization: () => void;
  openSettings: () => void;
  toggleBuilderMode: () => void;
  userTaskCount: number;
};

export const OFFICE_COMMAND_PALETTE_SHORTCUT: OfficeShortcut = {
  key: "k",
  label: "Ctrl/Cmd+K",
  metaOrCtrlKey: true,
};

export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const candidate = target as {
    closest?: (selector: string) => unknown;
    isContentEditable?: boolean;
  };

  if (candidate.isContentEditable) {
    return true;
  }

  if (typeof candidate.closest !== "function") {
    return false;
  }

  return Boolean(
    candidate.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]',
    ),
  );
}

export function eventMatchesShortcut(
  event: Pick<
    KeyboardEvent,
    "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
  >,
  shortcut: OfficeShortcut,
): boolean {
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  if (eventKey !== shortcutKey) {
    return false;
  }

  if (Boolean(event.altKey) !== Boolean(shortcut.altKey)) {
    return false;
  }
  if (Boolean(event.shiftKey) !== Boolean(shortcut.shiftKey)) {
    return false;
  }

  if (shortcut.metaOrCtrlKey) {
    if (!(event.metaKey || event.ctrlKey)) {
      return false;
    }
  } else {
    if (Boolean(event.metaKey) !== Boolean(shortcut.metaKey)) {
      return false;
    }
    if (Boolean(event.ctrlKey) !== Boolean(shortcut.ctrlKey)) {
      return false;
    }
  }

  return true;
}

export function createOfficePanelActions(
  deps: OfficePanelRegistryDependencies,
): OfficePanelAction[] {
  return [
    {
      id: "back-landing",
      label: "Back to Landing",
      description: "Leave the office and return to the public landing page.",
      group: "navigation",
      icon: Home,
      keywords: ["home", "landing", "exit", "navigate"],
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.navigateToLanding,
    },
    {
      id: "organization",
      label: "Organization",
      description: "Open the organization overview and people operations panel.",
      group: "panel",
      icon: Building2,
      keywords: ["teams", "people", "directory", "organization", "panel"],
      shortcut: { key: "o", label: "Alt+Shift+O", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openOrganization,
    },
    {
      id: "team-workspace",
      label: "Team Workspace",
      description: "Open the global team workspace with overview and kanban access.",
      group: "panel",
      icon: Users,
      keywords: ["team", "workspace", "kanban", "overview", "panel"],
      shortcut: { key: "t", label: "Alt+Shift+T", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      buttonClassName:
        deps.highlightedMenuActionId === "team-workspace" ? GUIDED_BUTTON_CLASS : undefined,
      perform: deps.openGlobalTeamWorkspace,
    },
    {
      id: "agent-session",
      label: "Agent Session",
      description: "Open live agent session timelines and session controls.",
      group: "panel",
      icon: Activity,
      keywords: ["agent", "session", "timeline", "runtime", "panel"],
      shortcut: { key: "a", label: "Alt+Shift+A", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openAgentSession,
    },
    {
      id: "global-skills",
      label: "Global Skills",
      description: "Open the skill studio for global skill browsing and management.",
      group: "panel",
      icon: BookOpen,
      keywords: ["skills", "studio", "library", "global", "panel"],
      shortcut: { key: "s", label: "Alt+Shift+S", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openGlobalSkills,
    },
    {
      id: "ceo-chat",
      label: "CEO Chat",
      description: "Open the main employee chat surface for the CEO agent.",
      group: "panel",
      icon: MessageSquare,
      keywords: ["chat", "ceo", "messages", "conversation", "panel"],
      shortcut: { key: "c", label: "Alt+Shift+C", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openCeoChat,
    },
    {
      id: "ceo-workbench",
      label: "CEO Workbench",
      description: "Open the CEO workbench board view.",
      group: "panel",
      icon: BriefcaseBusiness,
      keywords: ["ceo", "workbench", "board", "tasks", "panel"],
      shortcut: { key: "w", label: "Alt+Shift+W", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: () => deps.openCeoWorkbench("board"),
    },
    {
      id: "human-review",
      label: "Human Review",
      description: "Open the CEO workbench review lane for founder approval tasks.",
      group: "panel",
      icon: BriefcaseBusiness,
      keywords: ["review", "approval", "human", "ceo", "panel"],
      shortcut: { key: "r", label: "Alt+Shift+R", altKey: true, shiftKey: true },
      badge: deps.userTaskCount > 0 ? deps.userTaskCount : undefined,
      color: deps.userTaskCount > 0 ? EMPHASIZED_BUTTON_COLOR : SECONDARY_BUTTON_COLOR,
      perform: () => deps.openCeoWorkbench("review"),
    },
    {
      id: "builder-mode",
      label: deps.isBuilderMode ? "Exit Builder Mode" : "Builder Mode",
      description: "Toggle builder mode for placement and transform workflows.",
      group: "action",
      icon: Hammer,
      keywords: ["builder", "layout", "decor", "placement", "mode"],
      shortcut: { key: "b", label: "Alt+Shift+B", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      disabled: deps.isAnimatingCamera,
      perform: deps.toggleBuilderMode,
    },
    {
      id: "office-shop",
      label: "Decoration",
      description: "Open the decoration shop for office objects and furniture.",
      group: "panel",
      icon: ShoppingBag,
      keywords: ["shop", "decoration", "furniture", "office", "panel"],
      shortcut: { key: "d", label: "Alt+Shift+D", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      buttonClassName:
        deps.highlightedMenuActionId === "office-shop" ? GUIDED_BUTTON_CLASS : undefined,
      perform: deps.openDecoration,
    },
    {
      id: "settings",
      label: "Settings",
      description: "Open office settings and configuration preferences.",
      group: "panel",
      icon: Settings,
      keywords: ["settings", "preferences", "config", "panel"],
      shortcut: { key: "p", label: "Alt+Shift+P", altKey: true, shiftKey: true },
      color: SECONDARY_BUTTON_COLOR,
      perform: deps.openSettings,
    },
  ];
}
