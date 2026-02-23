import { describe, expect, it } from "vitest";
import { isBashCommandAllowed, isGatewayToolAllowed } from "./policy.js";

describe("isBashCommandAllowed", () => {
  it("allows safe commands", () => {
    expect(isBashCommandAllowed("ls -la")).toBe(true);
  });

  it("blocks dangerous commands", () => {
    expect(isBashCommandAllowed("rm -rf /")).toBe(false);
    expect(isBashCommandAllowed("shutdown now")).toBe(false);
  });
});

describe("isGatewayToolAllowed", () => {
  it("blocks denied tools first", () => {
    expect(isGatewayToolAllowed("ontology.query", { allow: [], deny: ["ontology.query"] })).toBe(false);
  });

  it("allows all when allowlist is empty", () => {
    expect(isGatewayToolAllowed("ontology.query", { allow: [], deny: [] })).toBe(true);
  });

  it("enforces allowlist when provided", () => {
    expect(isGatewayToolAllowed("ontology.query", { allow: ["ontology.query"], deny: [] })).toBe(true);
    expect(isGatewayToolAllowed("cron.add", { allow: ["ontology.query"], deny: [] })).toBe(false);
  });
});
