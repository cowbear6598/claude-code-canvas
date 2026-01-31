import { ValidationError } from './errors.js';
import { isValidPodName, isValidPodType, isValidPodColor } from './validators.js';
import { CreatePodRequest, ChatRequest } from '../types/index.js';

/**
 * Validates the create pod request payload
 */
export function validateCreatePodRequest(data: unknown): asserts data is CreatePodRequest {
  const body = data as Record<string, unknown>;

  // Validate name
  if (!body.name || typeof body.name !== 'string') {
    throw new ValidationError('Pod name is required and must be a string');
  }
  if (!isValidPodName(body.name)) {
    throw new ValidationError(
      'Pod name must be non-empty, max 100 characters, and contain only alphanumeric characters, spaces, hyphens, and underscores'
    );
  }

  // Validate type
  if (!body.type || typeof body.type !== 'string') {
    throw new ValidationError('Pod type is required and must be a string');
  }
  if (!isValidPodType(body.type)) {
    throw new ValidationError(
      'Pod type must be one of: Code Assistant, Chat Companion, Creative Writer, Data Analyst, General AI'
    );
  }

  // Validate color
  if (!body.color || typeof body.color !== 'string') {
    throw new ValidationError('Pod color is required and must be a string');
  }
  if (!isValidPodColor(body.color)) {
    throw new ValidationError(
      'Pod color must be one of: blue, coral, pink, yellow, green'
    );
  }
}

/**
 * Validates the chat message request payload
 */
export function validateChatMessageRequest(data: unknown): asserts data is ChatRequest {
  const body = data as Record<string, unknown>;

  // Validate message
  if (!body.message || typeof body.message !== 'string') {
    throw new ValidationError('Message is required and must be a string');
  }

  const trimmed = body.message.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('Message cannot be empty');
  }

  if (trimmed.length > 10000) {
    throw new ValidationError('Message is too long (max 10000 characters)');
  }
}

// Export schema objects for use in validateRequest middleware
export const schemas = {
  createPod: validateCreatePodRequest,
  chatMessage: validateChatMessageRequest,
};
