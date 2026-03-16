import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LandingPage } from "./LandingPage";

vi.mock("../components/ui/button", () => ({
  Button: ({
    asChild,
    children,
    ...props
  }: {
    asChild?: boolean;
    children: ReactNode;
  }) =>
    asChild
      ? children
      : createElement("button", props, children),
}));

vi.mock("../components/theme/background-image", () => ({
  BackgroundImage: ({ alt, className }: { alt: string; className?: string }) =>
    createElement("img", { alt, className }),
}));

vi.mock("../components/theme/theme-toggle", () => ({
  ThemeToggle: () => createElement("button", { type: "button" }, "Theme"),
}));

describe("LandingPage", () => {
  it("renders direct office entry points and onboarding guidance without an invite gate", () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(LandingPage)),
    );
    const officeHrefCount = (markup.match(/href="\/office"/g) ?? []).length;

    expect(markup).toContain("Go to office");
    expect(markup).toContain("aria-label=\"Go to office from hero\"");
    expect(markup).toContain("Ask the CEO to build a team");
    expect(markup).toContain("Approve the work that matters");
    expect(markup).toContain("Watch the office run in real time");
    expect(officeHrefCount).toBe(3);
    expect(markup).not.toContain("Enter Invite Code");
    expect(markup).not.toContain("Access Zanarkand");
  });
});
