import type { Connection, Pod } from '../../types/index.js';
import { connectionStore } from '../connectionStore.js';
import { podStore } from '../podStore.js';
import { messageStore } from '../messageStore.js';

interface ValidationResult<T = void> {
  valid: boolean;
  data?: T;
  error?: string;
}

class WorkflowValidationService {
  validateConnection(connectionId: string): ValidationResult<Connection> {
    const connection = connectionStore.getById(connectionId);

    if (!connection) {
      return {
        valid: false,
        error: `Connection not found: ${connectionId}`,
      };
    }

    return {
      valid: true,
      data: connection,
    };
  }

  validatePod(podId: string): ValidationResult<Pod> {
    const pod = podStore.getById(podId);

    if (!pod) {
      return {
        valid: false,
        error: `Pod not found: ${podId}`,
      };
    }

    return {
      valid: true,
      data: pod,
    };
  }

  validateTargetPodStatus(targetPod: Pod): ValidationResult {
    if (targetPod.status === 'chatting' || targetPod.status === 'summarizing') {
      return {
        valid: false,
        error: `Target Pod ${targetPod.id} is ${targetPod.status}`,
      };
    }

    return { valid: true };
  }

  validateSourceHasMessages(sourcePodId: string): ValidationResult {
    const messages = messageStore.getMessages(sourcePodId);
    const assistantMessages = messages.filter((msg) => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      return {
        valid: false,
        error: `Source Pod ${sourcePodId} has no assistant messages to transfer`,
      };
    }

    return { valid: true };
  }
}

export const workflowValidationService = new WorkflowValidationService();
