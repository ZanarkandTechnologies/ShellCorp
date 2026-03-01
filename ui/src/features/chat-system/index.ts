export function useChatActions(): {
  openEmployeeChat: (employeeId: string, focus?: boolean) => Promise<void>;
  openTeamChat: (teamId: string, focus?: boolean) => Promise<void>;
} {
  const emitChatIntent = (payload: { agentId?: string; teamId?: string; focus?: boolean }): void => {
    window.dispatchEvent(new CustomEvent("office:open-chat", { detail: payload }));
  };

  return {
    async openEmployeeChat(employeeId: string, focus = true): Promise<void> {
      const agentId = employeeId.startsWith("employee-") ? employeeId.replace("employee-", "") : employeeId;
      emitChatIntent({ agentId, focus });
      return;
    },
    async openTeamChat(teamId: string, focus = true): Promise<void> {
      emitChatIntent({ teamId, focus });
      return;
    },
  };
}
