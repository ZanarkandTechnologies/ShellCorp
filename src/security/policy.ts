const forbiddenPatterns = [
  /\brm\s+-rf\s+\/($|\s)/,
  /\bshutdown\b/,
  /\breboot\b/,
  /:\(\)\s*\{\s*:\|\:&\s*\};:/, // fork bomb
];

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
