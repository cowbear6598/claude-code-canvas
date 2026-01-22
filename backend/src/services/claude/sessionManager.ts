// Claude Session Manager
// Manages multiple Claude Agent SDK sessions (one per Pod)
// Uses Claude Code CLI authentication (no API key required)

import { query, Query } from '@anthropic-ai/claude-agent-sdk';

class ClaudeSessionManager {
  private sessions: Map<string, Query> = new Map();

  /**
   * Create a new Claude session for a Pod
   * @param podId Unique Pod identifier
   * @param workspacePath Absolute path to Pod's workspace
   * @returns Query instance for this session
   */
  async createSession(podId: string, workspacePath: string): Promise<Query> {
    // If session already exists, return it
    if (this.sessions.has(podId)) {
      console.log(`[Claude] Session already exists for Pod ${podId}`);
      return this.sessions.get(podId)!;
    }

    // Create new session with workspace configuration
    // Uses Claude Code CLI authentication automatically
    const session = query({
      prompt: '', // Empty initial prompt, will be set in queryService
      options: {
        cwd: workspacePath,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
        permissionMode: 'acceptEdits',
        includePartialMessages: true, // Enable streaming partial messages
      },
    });

    this.sessions.set(podId, session);
    console.log(`[Claude] Created session for Pod ${podId} at ${workspacePath}`);

    return session;
  }

  /**
   * Get existing session for a Pod
   */
  getSession(podId: string): Query | undefined {
    return this.sessions.get(podId);
  }

  /**
   * Destroy a session (cleanup)
   */
  async destroySession(podId: string): Promise<void> {
    const session = this.sessions.get(podId);
    if (session) {
      // Note: Claude Agent SDK doesn't have explicit cleanup method
      // The session will be garbage collected when removed from map
      this.sessions.delete(podId);
      console.log(`[Claude] Destroyed session for Pod ${podId}`);
    }
  }

  /**
   * Check if a session exists for a Pod
   */
  hasSession(podId: string): boolean {
    return this.sessions.has(podId);
  }
}

// Export singleton instance
export const claudeSessionManager = new ClaudeSessionManager();
