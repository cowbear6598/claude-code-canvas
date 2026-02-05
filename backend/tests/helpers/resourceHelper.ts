import type { TestWebSocketClient } from '../setup';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { emitAndWaitResponse } from '../setup';
import { testConfig } from '../setup';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type OutputStyleCreatePayload,
  type RepositoryCreatePayload,
  type SubAgentCreatePayload,
  type CommandCreatePayload,
} from '../../src/schemas';
import {
  type OutputStyleCreatedPayload,
  type RepositoryCreatedPayload,
  type SubAgentCreatedPayload,
  type CommandCreatedPayload,
} from '../../src/types';

export async function createOutputStyle(
  client: TestWebSocketClient,
  name: string,
  content: string
): Promise<{ id: string; name: string }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const response = await emitAndWaitResponse<OutputStyleCreatePayload, OutputStyleCreatedPayload>(
    client,
    WebSocketRequestEvents.OUTPUT_STYLE_CREATE,
    WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
    { requestId: uuidv4(), canvasId, name, content }
  );

  return response.outputStyle!;
}

export async function createSkillFile(
  name: string,
  content: string
): Promise<string> {
  const skillDir = path.join(testConfig.skillsPath, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
  return name;
}

export async function createRepository(
  client: TestWebSocketClient,
  name: string
): Promise<{ id: string; name: string }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const response = await emitAndWaitResponse<RepositoryCreatePayload, RepositoryCreatedPayload>(
    client,
    WebSocketRequestEvents.REPOSITORY_CREATE,
    WebSocketResponseEvents.REPOSITORY_CREATED,
    { requestId: uuidv4(), canvasId, name }
  );

  return response.repository!;
}

export async function createSubAgent(
  client: TestWebSocketClient,
  name: string,
  content: string
): Promise<{ id: string; name: string }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const response = await emitAndWaitResponse<SubAgentCreatePayload, SubAgentCreatedPayload>(
    client,
    WebSocketRequestEvents.SUBAGENT_CREATE,
    WebSocketResponseEvents.SUBAGENT_CREATED,
    { requestId: uuidv4(), canvasId, name, content }
  );

  return response.subAgent!;
}

export async function createCommand(
  client: TestWebSocketClient,
  name: string,
  content: string
): Promise<{ id: string; name: string }> {
  if (!client.id) {
    throw new Error('Socket not connected');
  }

  const canvasModule = await import('../../src/services/canvasStore.js');
  const canvasId = canvasModule.canvasStore.getActiveCanvas(client.id);

  if (!canvasId) {
    throw new Error('No active canvas for socket');
  }

  const response = await emitAndWaitResponse<CommandCreatePayload, CommandCreatedPayload>(
    client,
    WebSocketRequestEvents.COMMAND_CREATE,
    WebSocketResponseEvents.COMMAND_CREATED,
    { requestId: uuidv4(), canvasId, name, content }
  );

  return response.command!;
}
