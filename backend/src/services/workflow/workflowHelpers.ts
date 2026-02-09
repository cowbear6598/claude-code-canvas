import type {Pod, Command} from '../../types/index.js';

export function formatMergedSummaries(
    summaries: Map<string, string>,
    podLookup: (podId: string) => Pod | undefined
): string {
    const formatted: string[] = [];

    for (const [sourcePodId, content] of summaries.entries()) {
        const sourcePod = podLookup(sourcePodId);
        const podName = sourcePod?.name || sourcePodId;

        formatted.push(`## Source: ${podName}\n${content}\n\n---`);
    }

    let result = formatted.join('\n\n');
    result = result.replace(/\n\n---$/, '');

    return result;
}

export function buildTransferMessage(content: string): string {
    return `以下是從另一個 POD 傳遞過來的內容,請根據這些資訊繼續處理:

---
${content}
---`;
}

export function buildMessageWithCommand(
    baseMessage: string,
    targetPod: Pod | undefined,
    commands: Command[]
): string {
    if (!targetPod?.commandId) {
        return baseMessage;
    }

    const command = commands.find((cmd) => cmd.id === targetPod.commandId);
    if (!command) {
        return baseMessage;
    }

    return `/${command.name} ${baseMessage}`;
}
