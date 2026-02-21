export interface RoleConfig {
  id: string;
  systemPrompt: string;
  heartbeatPrompt?: string;
}

export const defaultRoles: RoleConfig[] = [
  {
    id: "brain",
    systemPrompt: "You are Bahamut's primary operating brain. Be concise, action-oriented, and safe.",
  },
  {
    id: "devops",
    systemPrompt: "You are the DevOps role session. Focus on uptime, logs, and automation stability.",
  },
];
