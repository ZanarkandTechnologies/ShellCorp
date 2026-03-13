import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { buildOfficeBootstrapStages } from "./office-bootstrap";
import { OfficeLoader } from "./office-loader";

vi.mock("@/components/ai-elements/loader", () => ({
  Loader: ({ className }: { className?: string }) =>
    createElement("div", { className, "data-testid": "loader" }, "spinner"),
}));

describe("office loader", () => {
  it("renders wrapped stage cards and the active progress label", () => {
    const stages = buildOfficeBootstrapStages({
      dataReady: true,
      meshesReady: false,
      navigationReady: false,
    });

    const markup = renderToStaticMarkup(
      createElement(OfficeLoader, { completionRatio: 2 / 3, stages }),
    );

    expect(markup).toContain("Loading office");
    expect(markup).toContain("Preparing scene assets");
    expect(markup).toContain("Building navigation grid");
    expect(markup).toContain("Bootstrap progress");
    expect(markup).toContain("67%");
    expect(markup).toContain("grid w-full max-w-4xl gap-3 md:grid-cols-3");
    expect(markup).toContain("In progress");
    expect(markup).not.toContain("truncate");
  });
});
