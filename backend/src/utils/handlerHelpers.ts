import type { WebSocketResponseEvents } from '../schemas/index.js';
import type { Pod } from '../types/index.js';
import { podStore } from '../services/podStore.js';
import { canvasStore } from '../services/canvasStore.js';
import { socketService } from '../services/socketService.js';
import { emitError } from './websocketResponse.js';
import { logger, type LogCategory } from './logger.js';

export function getCanvasId(
	connectionId: string,
	responseEvent: WebSocketResponseEvents,
	requestId: string
): string | undefined {
	const canvasId = canvasStore.getActiveCanvas(connectionId);

	if (!canvasId) {
		emitError(connectionId, responseEvent, 'No active canvas', requestId, undefined, 'INTERNAL_ERROR');
		return undefined;
	}

	return canvasId;
}

export type HandlerWithCanvasId<TPayload = unknown> = (
	connectionId: string,
	canvasId: string,
	payload: TPayload,
	requestId: string
) => Promise<void>;

export type StandardHandler<TPayload = unknown> = (
	connectionId: string,
	payload: TPayload,
	requestId: string
) => Promise<void>;

export function withCanvasId<TPayload = unknown>(
	responseEvent: WebSocketResponseEvents,
	handler: HandlerWithCanvasId<TPayload>
): StandardHandler<TPayload> {
	return async (connectionId: string, payload: TPayload, requestId: string): Promise<void> => {
		const canvasId = getCanvasId(connectionId, responseEvent, requestId);
		if (!canvasId) {
			return;
		}

		await handler(connectionId, canvasId, payload, requestId);
	};
}

export function validatePod(
	connectionId: string,
	podId: string,
	responseEvent: WebSocketResponseEvents,
	requestId: string
): Pod | undefined {
	const canvasId = getCanvasId(connectionId, responseEvent, requestId);
	if (!canvasId) {
		return undefined;
	}

	const pod = podStore.getById(canvasId, podId);

	if (!pod) {
		emitError(connectionId, responseEvent, `Pod 找不到: ${podId}`, requestId, podId, 'NOT_FOUND');
		return undefined;
	}

	return pod;
}

interface ResourceDeleteConfig {
	connectionId: string;
	requestId: string;
	resourceId: string;
	resourceName: LogCategory;
	responseEvent: WebSocketResponseEvents;
	existsCheck: () => Promise<boolean>;
	findPodsUsing: (canvasId: string) => Pod[];
	deleteNotes: (canvasId: string) => string[];
	deleteResource: () => Promise<void>;
	idFieldName?: string;
}

export async function handleResourceDelete(config: ResourceDeleteConfig): Promise<void> {
	const {
		connectionId,
		requestId,
		resourceId,
		resourceName,
		responseEvent,
		existsCheck,
		findPodsUsing,
		deleteNotes,
		deleteResource,
		idFieldName,
	} = config;

	const canvasId = getCanvasId(connectionId, responseEvent, requestId);
	if (!canvasId) {
		return;
	}

	const exists = await existsCheck();
	if (!exists) {
		emitError(
			connectionId,
			responseEvent,
			`${resourceName} 找不到: ${resourceId}`,
			requestId,
			undefined,
			'NOT_FOUND'
		);
		return;
	}

	const podsUsing = findPodsUsing(canvasId);
	if (podsUsing.length > 0) {
		emitError(
			connectionId,
			responseEvent,
			`${resourceName} 正在被 ${podsUsing.length} 個 Pod 使用中，無法刪除`,
			requestId,
			undefined,
			'IN_USE'
		);
		return;
	}

	const deletedNoteIds = deleteNotes(canvasId);
	await deleteResource();

	const fieldName = idFieldName ?? `${resourceName.toLowerCase()}Id`;
	const response = {
		requestId,
		success: true,
		[fieldName]: resourceId,
		deletedNoteIds,
	};

	socketService.emitToAll(responseEvent, response);

	logger.log(resourceName, 'Delete', `Deleted ${resourceName.toLowerCase()} ${resourceId} and ${deletedNoteIds.length} notes`);
}
