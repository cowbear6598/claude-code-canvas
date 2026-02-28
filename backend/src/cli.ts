import fs from 'fs';
import path from 'path';
import os from 'os';
import pkg from '../../package.json';

const APP_DATA_DIR = path.join(os.homedir(), 'Documents', 'ClaudeCanvas');
const PID_FILE = path.join(APP_DATA_DIR, 'claude-canvas.pid');
const CONFIG_FILE = path.join(APP_DATA_DIR, 'config.json');
const LOG_DIR = path.join(APP_DATA_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'claude-canvas.log');

export const VALID_CONFIG_KEYS = ['GITHUB_TOKEN', 'GITLAB_TOKEN', 'GITLAB_URL'];

const HELP_TEXT = `Claude Canvas - AI Agent 畫布工具

使用方式：
  claude-canvas <命令> [選項]

命令：
  start [--port <number>]       啟動服務（背景 daemon 模式）
  stop                          停止服務
  status                        查看服務狀態
  config set <key> <value>      設定配置
  config get <key>              查看配置
  config list                   列出所有配置

選項：
  -v, --version                 顯示版本號
  -h, --help                    顯示此說明`;

export function parseCommand(argv: string[]): {
	command: string | null;
	args: string[];
	flags: Record<string, string | boolean>;
} {
	// 略過 bun / node 執行路徑和腳本路徑（前兩個參數）
	const rawArgs = argv.slice(2);

	const flags: Record<string, string | boolean> = {};
	const positional: string[] = [];

	let i = 0;
	while (i < rawArgs.length) {
		const arg = rawArgs[i];

		if (arg === '--version' || arg === '-v') {
			flags.version = true;
		} else if (arg === '--help' || arg === '-h') {
			flags.help = true;
		} else if (arg === '--daemon') {
			flags.daemon = true;
		} else if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const next = rawArgs[i + 1];
			if (next !== undefined && !next.startsWith('-')) {
				flags[key] = next;
				i++;
			} else {
				flags[key] = true;
			}
		} else {
			positional.push(arg);
		}

		i++;
	}

	const command = positional[0] ?? null;
	const args = positional.slice(1);

	return { command, args, flags };
}

export function validatePort(value: string): number | null {
	const num = Number(value);
	if (!Number.isInteger(num) || num < 1 || num > 65535) return null;
	return num;
}

export function readConfig(configPath: string): Record<string, string> {
	if (!fs.existsSync(configPath)) return {};

	try {
		const content = fs.readFileSync(configPath, 'utf-8');
		const raw = JSON.parse(content);
		const config: Record<string, string> = {};
		for (const [key, value] of Object.entries(raw)) {
			if (typeof value === 'string') {
				config[key] = value;
			}
		}
		return config;
	} catch {
		return {};
	}
}

export function writeConfig(configPath: string, config: Record<string, string>): void {
	const dir = path.dirname(configPath);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function readPidFile(pidPath: string): { pid: number; port: number; startedAt: string } | null {
	if (!fs.existsSync(pidPath)) return null;

	try {
		const content = fs.readFileSync(pidPath, 'utf-8');
		const data = JSON.parse(content) as { pid: number; port: number; startedAt: string };
		if (typeof data.pid !== 'number' || typeof data.port !== 'number' || typeof data.startedAt !== 'string') {
			return null;
		}
		return data;
	} catch {
		return null;
	}
}

export function writePidFile(pidPath: string, data: { pid: number; port: number; startedAt: string }): void {
	const dir = path.dirname(pidPath);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(pidPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function validateConfigKey(key: string, usage: string): void {
	if (VALID_CONFIG_KEYS.includes(key)) return;
	console.error(`錯誤：不支援的設定 key「${key}」`);
	console.error(`可用的 key：${VALID_CONFIG_KEYS.join('、')}`);
	console.error(`使用方式：${usage}`);
	process.exit(1);
}

function maskToken(value: string): string {
	if (value.length <= 4) return '****';
	return value.slice(0, 4) + '****';
}

function formatUptime(startedAt: string): string {
	const startMs = new Date(startedAt).getTime();
	const nowMs = Date.now();
	const diffSec = Math.floor((nowMs - startMs) / 1000);

	const days = Math.floor(diffSec / 86400);
	const hours = Math.floor((diffSec % 86400) / 3600);
	const minutes = Math.floor((diffSec % 3600) / 60);

	return `${days}d ${hours}h ${minutes}m`;
}

async function handleStart(flags: Record<string, string | boolean>): Promise<void> {
	const portStr = typeof flags.port === 'string' ? flags.port : '3001';
	const port = validatePort(portStr);

	if (port === null) {
		console.error(`錯誤：無效的 port 值「${portStr}」，必須是 1 到 65535 之間的整數`);
		process.exit(1);
	}

	const existingPid = readPidFile(PID_FILE);
	if (existingPid && isProcessAlive(existingPid.pid)) {
		console.error(`服務已在運行中（PID: ${existingPid.pid}, Port: ${existingPid.port}）`);
		process.exit(1);
	}

	const config = readConfig(CONFIG_FILE);
	const envOverrides: Record<string, string> = {};
	for (const key of VALID_CONFIG_KEYS) {
		if (config[key]) {
			envOverrides[key] = config[key];
		}
	}

	fs.mkdirSync(LOG_DIR, { recursive: true });
	const logFd = fs.openSync(LOG_FILE, 'a');

	// compile 模式下，可執行檔本身就是入口，不需要 script 路徑
	// 非 compile 模式下（bun cli.ts），需要 script 路徑
	const isCompiled = !process.argv[1] || process.argv[1].includes('$bunfs');
	const spawnArgs = isCompiled
		? [process.execPath, '--daemon', '--port', String(port)]
		: [process.execPath, process.argv[1], '--daemon', '--port', String(port)];

	const child = Bun.spawn(
		spawnArgs,
		{
			env: { ...process.env, ...envOverrides },
			stdout: logFd,
			stderr: logFd,
			detached: true,
		},
	);

	child.unref();
	fs.closeSync(logFd);

	writePidFile(PID_FILE, {
		pid: child.pid,
		port,
		startedAt: new Date().toISOString(),
	});

	console.log(`服務已啟動（PID: ${child.pid}, Port: ${port}）`);
	process.exit(0);
}

function handleStop(): void {
	const pidData = readPidFile(PID_FILE);

	if (pidData === null) {
		console.log('服務未在運行中');
		process.exit(0);
	}

	try {
		process.kill(pidData.pid, 'SIGTERM');
	} catch (err) {
		const error = err as NodeJS.ErrnoException;
		if (error.code === 'ESRCH') {
			console.log('服務未在運行中（PID 檔案已過期）');
		} else {
			console.error(`停止服務時發生錯誤：${error.message}`);
		}
		fs.unlinkSync(PID_FILE);
		return;
	}

	fs.unlinkSync(PID_FILE);
	console.log('服務已停止');
}

function handleStatus(): void {
	const pidData = readPidFile(PID_FILE);

	if (pidData === null) {
		console.log('服務未在運行中');
		process.exit(0);
	}

	if (!isProcessAlive(pidData.pid)) {
		console.log('服務未在運行中（PID 檔案已過期）');
		fs.unlinkSync(PID_FILE);
		process.exit(0);
	}

	const uptime = formatUptime(pidData.startedAt);
	console.log(`狀態：運行中`);
	console.log(`PID：${pidData.pid}`);
	console.log(`Port：${pidData.port}`);
	console.log(`已運行：${uptime}`);
}

function handleConfig(args: string[]): void {
	const subCommand = args[0];

	if (subCommand === 'set') {
		const key = args[1];
		const value = args[2];

		if (!key || !value) {
			console.error('使用方式：claude-canvas config set <key> <value>');
			process.exit(1);
		}

		validateConfigKey(key, 'claude-canvas config set <key> <value>');

		const config = readConfig(CONFIG_FILE);
		config[key] = value;
		writeConfig(CONFIG_FILE, config);
		console.log(`已設定 ${key}`);
		return;
	}

	if (subCommand === 'get') {
		const key = args[1];

		if (!key) {
			console.error('使用方式：claude-canvas config get <key>');
			process.exit(1);
		}

		validateConfigKey(key, 'claude-canvas config get <key>');

		const config = readConfig(CONFIG_FILE);
		const value = config[key];

		if (value === undefined) {
			console.log('尚未設定');
		} else {
			const isToken = key.endsWith('_TOKEN');
			console.log(isToken ? maskToken(value) : value);
		}
		return;
	}

	if (subCommand === 'list') {
		const config = readConfig(CONFIG_FILE);
		const entries = Object.entries(config);

		if (entries.length === 0) {
			console.log('尚無任何配置');
			return;
		}

		for (const [key, value] of entries) {
			const isToken = key.endsWith('_TOKEN');
			const displayValue = isToken ? maskToken(value) : value;
			console.log(`${key}=${displayValue}`);
		}
		return;
	}

	console.error('使用方式：claude-canvas config <set|get|list>');
	process.exit(1);
}

async function runDaemon(flags: Record<string, string | boolean>): Promise<void> {
	const portStr = typeof flags.port === 'string' ? flags.port : '3001';
	process.env.PORT = portStr;
	process.env.NODE_ENV = 'production';
	await import('./index.js');
}

async function main(): Promise<void> {
	const { command, args, flags } = parseCommand(process.argv);

	if (flags.daemon) {
		await runDaemon(flags);
		return;
	}

	if (flags.version) {
		console.log(pkg.version);
		process.exit(0);
	}

	if (flags.help || command === null) {
		console.log(HELP_TEXT);
		process.exit(0);
	}

	if (command === 'start') {
		await handleStart(flags);
		return;
	}

	if (command === 'stop') {
		handleStop();
		return;
	}

	if (command === 'status') {
		handleStatus();
		return;
	}

	if (command === 'config') {
		handleConfig(args);
		return;
	}

	console.error(`未知命令：${command}`);
	console.log(HELP_TEXT);
	process.exit(1);
}

// 只在直接執行時啟動，避免被 import 時觸發
if (import.meta.main) {
	main().catch((err) => {
		console.error('發生未預期的錯誤：', err);
		process.exit(1);
	});
}
