import { describe, expect, it } from "vitest";
import { gatewayRpcMethodToToolName, isBashCommandAllowed, isGatewayToolAllowed, isGatewayWriteMethod } from "./policy.js";

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

describe("gateway RPC policy helpers", () => {
  it("maps configured methods to tool names", () => {
    expect(gatewayRpcMethodToToolName("cron.add")).toBe("cron.add");
    expect(gatewayRpcMethodToToolName("config.apply")).toBe("config.apply");
    expect(gatewayRpcMethodToToolName("group.rollup.aggregate")).toBe("group.rollup.aggregate");
    expect(gatewayRpcMethodToToolName("connector.onboarding.discover")).toBe("connector.onboarding.discover");
    expect(gatewayRpcMethodToToolName("connector.onboarding.propose")).toBe("connector.onboarding.propose");
    expect(gatewayRpcMethodToToolName("connector.onboarding.commit")).toBe("connector.onboarding.commit");
    expect(gatewayRpcMethodToToolName("config.get")).toBeNull();
  });

  it("classifies write methods", () => {
    expect(isGatewayWriteMethod("config.apply")).toBe(true);
    expect(isGatewayWriteMethod("cron.update")).toBe(true);
    expect(isGatewayWriteMethod("connector.onboarding.commit")).toBe(true);
    expect(isGatewayWriteMethod("cron.list")).toBe(false);
    expect(isGatewayWriteMethod("config.get")).toBe(false);
  });
});
