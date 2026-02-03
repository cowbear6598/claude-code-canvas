import { query, Query } from '@anthropic-ai/claude-agent-sdk';

class ClaudeSessionManager {
  private sessions: Map<string, Query> = new Map();

  async createSession(podId: string, workspacePath: string): Promise<Query> {
    if (this.sessions.has(podId)) {
      return this.sessions.get(podId)!;
    }

    const session = query({
      prompt: '',
      options: {
        cwd: workspacePath,
        settingSources: ['project'],
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true,
      },
    });

    this.sessions.set(podId, session);

    return session;
  }

  getSession(podId: string): Query | undefined {
    return this.sessions.get(podId);
  }

  async destroySession(podId: string): Promise<void> {
    const session = this.sessions.get(podId);
    if (session) {
      this.sessions.delete(podId);
    }
  }

  hasSession(podId: string): boolean {
    return this.sessions.has(podId);
  }
}

export const claudeSessionManager = new ClaudeSessionManager();
