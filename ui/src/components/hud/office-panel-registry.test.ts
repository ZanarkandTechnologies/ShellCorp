import { describe, expect, it, vi } from "vitest";

import {
  OFFICE_COMMAND_PALETTE_SHORTCUT,
  createOfficePanelActions,
  eventMatchesShortcut,
  isEditableEventTarget,
} from "./office-panel-registry";

describe("office panel registry", () => {
  it("matches the palette shortcut with ctrl/cmd+k", () => {
    expect(
      eventMatchesShortcut(
        { altKey: false, ctrlKey: true, key: "k", metaKey: false, shiftKey: false },
        OFFICE_COMMAND_PALETTE_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      eventMatchesShortcut(
        { altKey: false, ctrlKey: false, key: "k", metaKey: true, shiftKey: false },
        OFFICE_COMMAND_PALETTE_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      eventMatchesShortcut(
        { altKey: true, ctrlKey: true, key: "k", metaKey: false, shiftKey: false },
        OFFICE_COMMAND_PALETTE_SHORTCUT,
      ),
    ).toBe(false);
  });

  it("treats text inputs and contenteditable nodes as editable targets", () => {
    const input = {
      closest: vi.fn(() => ({ tagName: "INPUT" })),
      isContentEditable: false,
    };
    const editable = {
      closest: vi.fn(() => null),
      isContentEditable: true,
    };
    const plain = {
      closest: vi.fn(() => null),
      isContentEditable: false,
    };

    expect(isEditableEventTarget(input as unknown as EventTarget)).toBe(true);
    expect(isEditableEventTarget(editable as unknown as EventTarget)).toBe(true);
    expect(isEditableEventTarget(plain as unknown as EventTarget)).toBe(false);
  });

  it("routes review and workspace actions through the provided handlers", () => {
    const openCeoWorkbench = vi.fn();
    const openGlobalTeamWorkspace = vi.fn();
    const toggleBuilderMode = vi.fn();

    const actions = createOfficePanelActions({
      highlightedMenuActionId: null,
      isAnimatingCamera: false,
      isBuilderMode: false,
      navigateToLanding: vi.fn(),
      openAgentSession: vi.fn(),
      openCeoChat: vi.fn(),
      openCeoWorkbench,
      openDecoration: vi.fn(),
      openGlobalSkills: vi.fn(),
      openGlobalTeamWorkspace,
      openOrganization: vi.fn(),
      openSettings: vi.fn(),
      toggleBuilderMode,
      userTaskCount: 3,
    });

    actions.find((action) => action.id === "team-workspace")?.perform();
    actions.find((action) => action.id === "human-review")?.perform();
    actions.find((action) => action.id === "builder-mode")?.perform();

    expect(openGlobalTeamWorkspace).toHaveBeenCalledTimes(1);
    expect(openCeoWorkbench).toHaveBeenCalledWith("review");
    expect(toggleBuilderMode).toHaveBeenCalledTimes(1);
  });
});
