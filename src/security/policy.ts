const forbiddenPatterns = [
  /\brm\s+-rf\s+\/($|\s)/,
  /\bshutdown\b/,
  /\breboot\b/,
  /:\(\)\s*\{\s*:\|\:&\s*\};:/, // fork bomb
];

const rpcToolNameByMethod: Record<string, string> = {
  "ingest.message": "ingest",
  "providers.test": "providers.test",
  "ontology.query": "ontology.query",
  "ontology.text": "ontology.text",
  "skills.execute": "skills.execute",
  "connector.bootstrap.preview": "connector.bootstrap.preview",
  "connector.bootstrap.prove": "connector.bootstrap.prove",
  "connector.bootstrap.commit": "connector.bootstrap.commit",
  "connector.onboarding.discover": "connector.onboarding.discover",
  "connector.onboarding.propose": "connector.onboarding.propose",
  "connector.onboarding.commit": "connector.onboarding.commit",
  "memory.observation.append": "memory.observation.append",
  "group.rollup.aggregate": "group.rollup.aggregate",
  "config.reload": "config.reload",
  "config.apply": "config.apply",
  "cron.add": "cron.add",
  "cron.update": "cron.update",
  "cron.enable": "cron.enable",
  "cron.disable": "cron.disable",
  "cron.remove": "cron.remove",
};

const writeMethods = new Set<string>([
  "config.reload",
  "config.apply",
  "connector.onboarding.commit",
  "cron.add",
  "cron.update",
  "cron.enable",
  "cron.disable",
  "cron.remove",
]);

export function isBashCommandAllowed(command: string): boolean {
  return !forbiddenPatterns.some((pattern) => pattern.test(command));
}

export function isGatewayToolAllowed(
  toolName: string,
  policy: {
    allow: string[];
    deny: string[];
  },
): boolean {
  if (policy.deny.includes(toolName)) return false;
  if (policy.allow.length === 0) return true;
  return policy.allow.includes(toolName);
}

export function gatewayRpcMethodToToolName(method: string): string | null {
  return rpcToolNameByMethod[method] ?? null;
}

export function isGatewayWriteMethod(method: string): boolean {
  return writeMethods.has(method);
}
