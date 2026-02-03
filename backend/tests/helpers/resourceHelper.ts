import type { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { emitAndWaitResponse } from '../setup/index.js';
import { testConfig } from '../setup/index.js';
import {
  WebSocketRequestEvents,
  WebSocketResponseEvents,
  type OutputStyleCreatePayload,
  type OutputStyleCreatedPayload,
  type RepositoryCreatePayload,
  type RepositoryCreatedPayload,
  type SubAgentCreatePayload,
  type SubAgentCreatedPayload,
  type CommandCreatePayload,
  type CommandCreatedPayload,
} from '../../src/types/index.js';

export async function createOutputStyle(
  client: Socket,
  name: string,
  content: string
): Promise<{ id: string; name: string }> {
  const response = await emitAndWaitResponse<OutputStyleCreatePayload, OutputStyleCreatedPayload>(
    client,
    WebSocketRequestEvents.OUTPUT_STYLE_CREATE,
    WebSocketResponseEvents.OUTPUT_STYLE_CREATED,
    { requestId: uuidv4(), name, content }
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
  client: Socket,
  name: string
): Promise<{ id: string; name: string }> {
  const response = await emitAndWaitResponse<RepositoryCreatePayload, RepositoryCreatedPayload>(
    client,
    WebSocketRequestEvents.REPOSITORY_CREATE,
    WebSocketResponseEvents.REPOSITORY_CREATED,
    { requestId: uuidv4(), name }
  );

  return response.repository!;
}

export async function createSubAgent(
  client: Socket,
  name: string,
  content: string
): Promise<{ id: string; name: string }> {
  const response = await emitAndWaitResponse<SubAgentCreatePayload, SubAgentCreatedPayload>(
    client,
    WebSocketRequestEvents.SUBAGENT_CREATE,
    WebSocketResponseEvents.SUBAGENT_CREATED,
    { requestId: uuidv4(), name, content }
  );

  return response.subAgent!;
}

export async function createCommand(
  client: Socket,
  name: string,
  content: string
): Promise<{ id: string; name: string }> {
  const response = await emitAndWaitResponse<CommandCreatePayload, CommandCreatedPayload>(
    client,
    WebSocketRequestEvents.COMMAND_CREATE,
    WebSocketResponseEvents.COMMAND_CREATED,
    { requestId: uuidv4(), name, content }
  );

  return response.command!;
}
