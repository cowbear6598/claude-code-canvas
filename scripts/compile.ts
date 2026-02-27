import { Glob } from 'bun';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = path.resolve(import.meta.dir, '..');
const FRONTEND_DIST = path.join(ROOT_DIR, 'frontend', 'dist');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ENTRYPOINT = path.join(ROOT_DIR, 'backend', 'src', 'cli.ts');

const SUPPORTED_TARGETS = [
	'bun-darwin-arm64',
	'bun-darwin-x64',
	'bun-linux-x64',
	'bun-linux-arm64',
] as const;

type SupportedTarget = (typeof SUPPORTED_TARGETS)[number];

function isSupportedTarget(value: string): value is SupportedTarget {
	return SUPPORTED_TARGETS.includes(value as SupportedTarget);
}

function getOutfile(target: string | undefined): string {
	if (!target) return path.join(DIST_DIR, 'claude-canvas');

	// target 格式：bun-darwin-arm64 → claude-canvas-darwin-arm64
	const suffix = target.replace(/^bun-/, '');
	return path.join(DIST_DIR, `claude-canvas-${suffix}`);
}

async function scanFrontendFiles(): Promise<string[]> {
	const glob = new Glob('**/*');
	const files: string[] = [];

	for await (const file of glob.scan({ cwd: FRONTEND_DIST, onlyFiles: true })) {
		files.push(path.join(FRONTEND_DIST, file));
	}

	return files;
}

async function compile(): Promise<void> {
	const target = process.env.TARGET;

	if (target !== undefined && !isSupportedTarget(target)) {
		console.error(`錯誤：不支援的 TARGET「${target}」`);
		console.error(`支援的目標：${SUPPORTED_TARGETS.join('、')}`);
		process.exit(1);
	}

	if (!fs.existsSync(FRONTEND_DIST)) {
		console.error('錯誤：frontend/dist 目錄不存在，請先執行 bun run build:frontend');
		process.exit(1);
	}

	const frontendFiles = await scanFrontendFiles();

	if (frontendFiles.length === 0) {
		console.error('錯誤：frontend/dist 目錄為空，請先執行 bun run build:frontend');
		process.exit(1);
	}

	fs.mkdirSync(DIST_DIR, { recursive: true });

	const outfile = getOutfile(target);
	const platformLabel = target ?? '當前平台';

	console.log(`開始編譯（目標：${platformLabel}）...`);
	console.log(`入口：${ENTRYPOINT}`);
	console.log(`前端靜態檔案：${frontendFiles.length} 個`);
	console.log(`輸出：${outfile}`);

	// Bun.build() programmatic API 在 compile 模式下不支援嵌入非 JS/TS 靜態資源，
	// 因此改用 Bun.spawn 呼叫 CLI，透過傳入多個檔案路徑的方式嵌入前端靜態檔案
	const args = [
		'build',
		'--compile',
		...(target ? ['--target', target] : []),
		ENTRYPOINT,
		...frontendFiles,
		'--outfile',
		outfile,
	];

	const proc = Bun.spawn(['bun', ...args], {
		cwd: ROOT_DIR,
		stdout: 'inherit',
		stderr: 'inherit',
	});

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		console.error(`錯誤：編譯失敗（exit code: ${exitCode}）`);
		process.exit(1);
	}

	const stat = fs.statSync(outfile);
	const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
	console.log(`編譯完成：${outfile}（${sizeMB} MB）`);
}

compile();
