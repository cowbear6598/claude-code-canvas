import { podStore } from '../services/podStore.js';
import { jsonResponse, resolveCanvas } from './apiHelpers.js';
import { createPodWithWorkspace } from '../services/podService.js';
import type { ModelType } from '../types/pod.js';

const VALID_MODELS: ModelType[] = ['opus', 'sonnet', 'haiku'];

interface ValidatedCreatePodBody {
	name: string;
	x: number;
	y: number;
	model: ModelType;
}

function validateCreatePodBody(data: Record<string, unknown>): { error: string } | ValidatedCreatePodBody {
	if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
		return { error: 'Pod 名稱不能為空' };
	}

	const name = data.name.trim();

	if (name.length > 100) {
		return { error: 'Pod 名稱不能超過 100 個字元' };
	}

	if (
		typeof data.x !== 'number' || typeof data.y !== 'number' ||
		!Number.isFinite(data.x) || !Number.isFinite(data.y) ||
		data.x < -100000 || data.x > 100000 || data.y < -100000 || data.y > 100000
	) {
		return { error: '必須提供有效的 x 和 y 座標' };
	}

	if (data.model !== undefined && !VALID_MODELS.includes(data.model as ModelType)) {
		return { error: '無效的模型類型' };
	}

	const model = (data.model as ModelType) ?? 'opus';

	return { name, x: data.x, y: data.y, model };
}

export function handleListPods(_req: Request, params: Record<string, string>): Response {
	const canvas = resolveCanvas(params.id);
	if (!canvas) {
		return jsonResponse({ error: '找不到 Canvas' }, 404);
	}

	const pods = podStore.getAll(canvas.id);
	return jsonResponse({ pods }, 200);
}

export async function handleCreatePod(req: Request, params: Record<string, string>): Promise<Response> {
	let body: unknown;

	try {
		body = await req.json();
	} catch {
		return jsonResponse({ error: '無效的請求格式' }, 400);
	}

	const canvas = resolveCanvas(params.id);
	if (!canvas) {
		return jsonResponse({ error: '找不到 Canvas' }, 404);
	}

	const validated = validateCreatePodBody(body as Record<string, unknown>);
	if ('error' in validated) {
		return jsonResponse({ error: validated.error }, 400);
	}

	const result = await createPodWithWorkspace(
		canvas.id,
		{
			name: validated.name,
			color: 'blue',
			x: validated.x,
			y: validated.y,
			rotation: 0,
			model: validated.model,
		},
		'system',
	);

	if (!result.success) {
		return jsonResponse({ error: result.error }, 500);
	}

	return jsonResponse({ pod: result.data!.pod }, 201);
}
