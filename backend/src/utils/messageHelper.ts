import { messageStore } from '../services/messageStore.js';

export function getLastAssistantMessage(podId: string): string | null {
  const messages = messageStore.getMessages(podId);
  const assistantMessages = messages.filter(message => message.role === 'assistant');
  if (assistantMessages.length === 0) {
    return null;
  }
  return assistantMessages[assistantMessages.length - 1].content;
}
