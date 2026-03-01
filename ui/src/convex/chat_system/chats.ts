export type ChatUIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: number;
};
