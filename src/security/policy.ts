const forbiddenPatterns = [
  /\brm\s+-rf\s+\/\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /:\(\)\s*\{\s*:\|\:&\s*\};:/, // fork bomb
];

export function isBashCommandAllowed(command: string): boolean {
  return !forbiddenPatterns.some((pattern) => pattern.test(command));
}
