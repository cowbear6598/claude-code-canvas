export type MessageRole = 'user' | 'assistant';

export interface ToolUseInfo {
  toolName: string;
  input: Record<string, unknown>;
  output: string | null;
}

export interface Message {
  id: string;
  podId: string;
  role: MessageRole;
  content: string;
  toolUse: ToolUseInfo | null;
  createdAt: Date;
}
