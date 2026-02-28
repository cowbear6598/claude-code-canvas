import {query, Query} from '@anthropic-ai/claude-agent-sdk';
import {getClaudeCodePath} from './claudePathResolver.js';

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
                pathToClaudeCodeExecutable: getClaudeCodePath(),
            },
        });

        this.sessions.set(podId, session);

        return session;
    }

    async destroySession(podId: string): Promise<void> {
        this.sessions.delete(podId);
    }
}

export const claudeSessionManager = new ClaudeSessionManager();
