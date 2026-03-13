import { describe, expect, it } from "vitest";

import {
  buildOfficeObjectMetadata,
  hasOfficeObjectRuntimeUi,
  normalizeHttpUrl,
  parseOfficeObjectInteractionConfig,
  parseOfficeObjectUiBinding,
} from "./office-object-ui";

describe("office object ui helpers", () => {
  it("normalizes and validates http urls", () => {
    expect(normalizeHttpUrl("https://earth.nullschool.net")).toBe("https://earth.nullschool.net/");
    expect(normalizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeHttpUrl("")).toBeNull();
  });

  it("parses embed bindings from metadata", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "embed",
          title: "World Monitor",
          url: "https://earth.nullschool.net",
          aspectRatio: "wide",
        },
      }),
    ).toEqual({
      kind: "embed",
      title: "World Monitor",
      url: "https://earth.nullschool.net/",
      openMode: "panel",
      aspectRatio: "wide",
    });
  });

  it("falls back to none for invalid bindings", () => {
    expect(
      parseOfficeObjectUiBinding({
        uiBinding: {
          kind: "embed",
          title: "Blocked",
          url: "ftp://example.com",
        },
      }),
    ).toEqual({ kind: "none" });
  });

  it("builds metadata without dropping unrelated keys", () => {
    const metadata = buildOfficeObjectMetadata(
      {
        meshPublicPath: "/assets/globe.glb",
      },
      {
        displayName: "Ops Globe",
        uiBinding: {
          kind: "embed",
          title: "World Monitor",
          url: "https://earth.nullschool.net/",
          openMode: "panel",
          aspectRatio: "wide",
        },
        skillBinding: null,
      },
    );

    expect(metadata.meshPublicPath).toBe("/assets/globe.glb");
    expect(metadata.displayName).toBe("Ops Globe");
    expect(hasOfficeObjectRuntimeUi(metadata)).toBe(true);
  });

  it("parses full interaction config", () => {
    expect(
      parseOfficeObjectInteractionConfig({
        displayName: "Ops Globe",
        uiBinding: {
          kind: "embed",
          title: "World Monitor",
          url: "https://earth.nullschool.net",
        },
        skillBinding: {
          skillId: "world-monitor",
          label: "World Monitor",
          effectMode: "random",
          effectPool: ["ghost", "blink"],
        },
      }),
    ).toEqual({
      displayName: "Ops Globe",
      uiBinding: {
        kind: "embed",
        title: "World Monitor",
        url: "https://earth.nullschool.net/",
        openMode: "panel",
        aspectRatio: undefined,
      },
      skillBinding: {
        skillId: "world-monitor",
        label: "World Monitor",
        effectMode: "random",
        effectVariant: undefined,
        effectPool: ["ghost", "blink"],
      },
    });
  });

  it("drops invalid skill effect variants", () => {
    expect(
      parseOfficeObjectInteractionConfig({
        skillBinding: {
          skillId: "world-monitor",
          effectMode: "fixed",
          effectVariant: "nope",
          effectPool: ["ghost", "bad"],
        },
      }),
    ).toEqual({
      displayName: undefined,
      uiBinding: { kind: "none" },
      skillBinding: {
        skillId: "world-monitor",
        label: undefined,
        effectMode: "fixed",
        effectVariant: undefined,
        effectPool: ["ghost"],
      },
    });
  });
});
