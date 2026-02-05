import type {PersistedSubMessage, PersistedToolUseInfo} from '../../types';

export interface SubMessageState {
    subMessages: PersistedSubMessage[];
    currentSubContent: string;
    currentSubToolUse: PersistedToolUseInfo[];
    subMessageCounter: number;
}

export function createSubMessageState(): SubMessageState {
    return {
        subMessages: [],
        currentSubContent: '',
        currentSubToolUse: [],
        subMessageCounter: 0,
    };
}

export function createSubMessageFlusher(messageId: string, state: SubMessageState) {
    return (): void => {
        if (state.currentSubContent || state.currentSubToolUse.length > 0) {
            state.subMessages.push({
                id: `${messageId}-sub-${state.subMessageCounter++}`,
                content: state.currentSubContent,
                toolUse: state.currentSubToolUse.length > 0 ? [...state.currentSubToolUse] : undefined,
            });
            state.currentSubContent = '';
            state.currentSubToolUse = [];
        }
    };
}

export function processTextEvent(
    content: string,
    accumulatedContentRef: {value: string},
    state: SubMessageState
): void {
    accumulatedContentRef.value += content;
    state.currentSubContent += content;
}

export function processToolUseEvent(
    toolUseId: string,
    toolName: string,
    input: Record<string, unknown>,
    state: SubMessageState,
    flushFn: () => void
): void {
    state.currentSubToolUse.push({
        toolUseId,
        toolName,
        input,
        status: 'completed',
    });
    flushFn();
}

export function processToolResultEvent(
    toolUseId: string,
    output: string,
    state: SubMessageState
): void {
    for (const sub of state.subMessages) {
        if (sub.toolUse) {
            const tool = sub.toolUse.find(t => t.toolUseId === toolUseId);
            if (tool) {
                tool.output = output;
                break;
            }
        }
    }
    const currentTool = state.currentSubToolUse.find(t => t.toolUseId === toolUseId);
    if (currentTool) {
        currentTool.output = output;
    }
}
