// Chat Controller
// Handles chat API endpoints and streaming responses
//
// @deprecated This controller is deprecated as of the WebSocket-first architecture migration.
// All chat operations should now be handled via WebSocket handlers in src/handlers/chatHandlers.ts
// This file is kept for reference purposes only.

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { podStore } from '../services/podStore.js';
import { claudeQueryService } from '../services/claude/queryService.js';
import { socketService } from '../services/socketService.js';
import {
  ChatRequest,
  ChatResponse,
  WebSocketEvents,
  PodMessagePayload,
  PodToolUsePayload,
  PodCompletePayload,
  PodErrorPayload,
} from '../types/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';

/**
 * Send a message to a Pod and get streaming response
 * POST /api/pods/:id/chat
 */
export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const podId = req.params.id as string;
    const { message } = req.body as ChatRequest;

    // Validate request body
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new ValidationError('Message must be a non-empty string');
    }

    // Get Pod
    const pod = podStore.getById(podId);
    if (!pod) {
      throw new NotFoundError(`Pod with id ${podId} not found`);
    }

    // Check if Pod is busy
    if (pod.status === 'busy') {
      throw new ConflictError('Pod is currently busy processing another message');
    }

    // Generate message ID
    const messageId = uuidv4();

    // Set Pod status to busy
    podStore.setStatus(podId, 'busy');
    podStore.updateLastActive(podId);

    // Return 202 Accepted immediately
    const response: ChatResponse = { messageId };
    res.status(202).json(response);

    // Process query asynchronously with WebSocket streaming
    processMessageAsync(podId, message, messageId).catch((error) => {
      console.error(`[Chat] Error processing message ${messageId}:`, error);
      podStore.setStatus(podId, 'error');

      // Emit error event to WebSocket clients
      const errorPayload: PodErrorPayload = {
        podId,
        error: error instanceof Error ? error.message : String(error),
        code: 'PROCESSING_ERROR',
      };
      socketService.emitToPod(podId, WebSocketEvents.POD_ERROR, errorPayload);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Process message asynchronously with streaming
 * This function runs in the background after responding to the client
 */
async function processMessageAsync(
  podId: string,
  message: string,
  messageId: string
): Promise<void> {
  try {
    console.log(`[Chat] Processing message ${messageId} for Pod ${podId}`);

    // Send message to Claude and handle streaming with WebSocket events
    await claudeQueryService.sendMessage(podId, message, (event) => {
      // Emit appropriate WebSocket event based on stream event type
      switch (event.type) {
        case 'text': {
          const payload: PodMessagePayload = {
            podId,
            messageId,
            content: event.content,
            isPartial: true,
          };
          socketService.emitToPod(podId, WebSocketEvents.POD_MESSAGE, payload);
          break;
        }

        case 'tool_use': {
          const payload: PodToolUsePayload = {
            podId,
            messageId,
            toolName: event.toolName,
            input: event.input,
          };
          socketService.emitToPod(podId, WebSocketEvents.POD_TOOL_USE, payload);
          break;
        }

        case 'complete': {
          const payload: PodCompletePayload = {
            podId,
            messageId,
          };
          socketService.emitToPod(podId, WebSocketEvents.POD_COMPLETE, payload);
          break;
        }

        case 'error': {
          const payload: PodErrorPayload = {
            podId,
            error: event.error,
            code: 'CLAUDE_ERROR',
          };
          socketService.emitToPod(podId, WebSocketEvents.POD_ERROR, payload);
          break;
        }

        case 'tool_result':
          // Tool results are handled internally by Claude SDK
          // We don't need to emit them to clients
          console.log(`[Chat] Tool result for ${messageId}: ${event.toolName}`);
          break;
      }
    });

    // Set Pod status back to idle
    podStore.setStatus(podId, 'idle');
    podStore.updateLastActive(podId);

    console.log(`[Chat] Completed message ${messageId} for Pod ${podId}`);
  } catch (error) {
    console.error(`[Chat] Failed to process message ${messageId}:`, error);
    podStore.setStatus(podId, 'error');
    throw error;
  }
}
