import fs from 'fs';
import path from 'path';
import os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	parseCommand,
	validatePort,
	readConfig,
	writeConfig,
	readPidFile,
	writePidFile,
	isProcessAlive,
	VALID_CONFIG_KEYS,
} from '../../src/cli.js';

const TMP_DIR = path.join(os.tmpdir(), `cli-test-${Date.now()}`);

beforeEach(() => {
	fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
	fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('parseCommand', () => {
	describe('CLI start 預設 port 為 3001', () => {
		it('解析 start 命令，flags 中無 port', () => {
			const result = parseCommand(['bun', 'cli.ts', 'start']);
			expect(result.command).toBe('start');
			expect(result.flags.port).toBeUndefined();
		});
	});

	describe('CLI start --port 8080 可自訂 port', () => {
		it('解析 start 命令並取得 port flag', () => {
			const result = parseCommand(['bun', 'cli.ts', 'start', '--port', '8080']);
			expect(result.command).toBe('start');
			expect(result.flags.port).toBe('8080');
		});
	});

	describe('CLI --version 顯示版本號', () => {
		it('解析 --version flag', () => {
			const result = parseCommand(['bun', 'cli.ts', '--version']);
			expect(result.flags.version).toBe(true);
		});

		it('解析 -v 短旗標', () => {
			const result = parseCommand(['bun', 'cli.ts', '-v']);
			expect(result.flags.version).toBe(true);
		});
	});

	describe('CLI --help 顯示使用說明', () => {
		it('解析 --help flag', () => {
			const result = parseCommand(['bun', 'cli.ts', '--help']);
			expect(result.flags.help).toBe(true);
		});

		it('解析 -h 短旗標', () => {
			const result = parseCommand(['bun', 'cli.ts', '-h']);
			expect(result.flags.help).toBe(true);
		});
	});

	it('無子命令時 command 為 null', () => {
		const result = parseCommand(['bun', 'cli.ts']);
		expect(result.command).toBeNull();
	});

	it('解析 config 子命令與 args', () => {
		const result = parseCommand(['bun', 'cli.ts', 'config', 'set', 'GITHUB_TOKEN', 'abc123']);
		expect(result.command).toBe('config');
		expect(result.args).toEqual(['set', 'GITHUB_TOKEN', 'abc123']);
	});
});

describe('validatePort', () => {
	describe('CLI start --port abc 不合法時顯示錯誤', () => {
		it('非數字字串回傳 null', () => {
			expect(validatePort('abc')).toBeNull();
		});

		it('port 0 回傳 null', () => {
			expect(validatePort('0')).toBeNull();
		});

		it('port 70000 超出範圍回傳 null', () => {
			expect(validatePort('70000')).toBeNull();
		});

		it('65536 超出範圍回傳 null', () => {
			expect(validatePort('65536')).toBeNull();
		});

		it('負數回傳 null', () => {
			expect(validatePort('-1')).toBeNull();
		});

		it('小數回傳 null', () => {
			expect(validatePort('3001.5')).toBeNull();
		});
	});

	describe('CLI start --port 8080 可自訂 port', () => {
		it('合法 port 8080 回傳數字', () => {
			expect(validatePort('8080')).toBe(8080);
		});

		it('port 1 回傳 1', () => {
			expect(validatePort('1')).toBe(1);
		});

		it('port 65535 回傳 65535', () => {
			expect(validatePort('65535')).toBe(65535);
		});

		it('port 3001 回傳 3001', () => {
			expect(validatePort('3001')).toBe(3001);
		});
	});
});

describe('readPidFile 與 writePidFile', () => {
	const pidPath = path.join(TMP_DIR, 'claude-canvas.pid');

	describe('CLI stop 正常停止服務', () => {
		it('寫入 PID 檔案後能正確讀取', () => {
			const data = { pid: process.pid, port: 3001, startedAt: new Date().toISOString() };
			writePidFile(pidPath, data);

			const result = readPidFile(pidPath);
			expect(result).not.toBeNull();
			expect(result!.pid).toBe(process.pid);
			expect(result!.port).toBe(3001);
			expect(typeof result!.startedAt).toBe('string');
		});
	});

	describe('CLI stop 服務未啟動時顯示提示', () => {
		it('檔案不存在回傳 null', () => {
			const result = readPidFile('/不存在的路徑/claude-canvas.pid');
			expect(result).toBeNull();
		});
	});

	describe('CLI status 服務運行中時顯示正確資訊', () => {
		it('讀取 PID 檔案並能解析 pid、port、startedAt', () => {
			const data = { pid: process.pid, port: 3001, startedAt: new Date().toISOString() };
			writePidFile(pidPath, data);

			const result = readPidFile(pidPath);
			expect(result).not.toBeNull();
			expect(typeof result!.pid).toBe('number');
			expect(typeof result!.port).toBe('number');
			expect(typeof result!.startedAt).toBe('string');
		});
	});

	it('損毀的 JSON 回傳 null', () => {
		fs.writeFileSync(pidPath, 'not-json', 'utf-8');
		expect(readPidFile(pidPath)).toBeNull();
	});
});

describe('isProcessAlive', () => {
	describe('CLI stop 正常停止服務', () => {
		it('當前程序存活回傳 true', () => {
			expect(isProcessAlive(process.pid)).toBe(true);
		});
	});

	describe('CLI status 服務未運行時顯示提示', () => {
		it('不存在的 PID 回傳 false', () => {
			expect(isProcessAlive(999999)).toBe(false);
		});
	});
});

describe('readConfig 與 writeConfig', () => {
	const configPath = path.join(TMP_DIR, 'config.json');

	describe('CLI config set/get/list 正常運作', () => {
		it('寫入後能正確讀取', () => {
			writeConfig(configPath, { GITHUB_TOKEN: 'test-token' });
			const result = readConfig(configPath);
			expect(result).toEqual({ GITHUB_TOKEN: 'test-token' });
		});

		it('檔案不存在回傳空物件', () => {
			const result = readConfig('/不存在的路徑/config.json');
			expect(result).toEqual({});
		});

		it('VALID_CONFIG_KEYS 包含正確的三個 key', () => {
			expect(VALID_CONFIG_KEYS).toContain('GITHUB_TOKEN');
			expect(VALID_CONFIG_KEYS).toContain('GITLAB_TOKEN');
			expect(VALID_CONFIG_KEYS).toContain('GITLAB_URL');
			expect(VALID_CONFIG_KEYS).toHaveLength(3);
		});

		it('多次 writeConfig 會覆蓋舊值', () => {
			writeConfig(configPath, { GITHUB_TOKEN: 'first' });
			writeConfig(configPath, { GITHUB_TOKEN: 'second', GITLAB_URL: 'https://gitlab.example.com' });

			const result = readConfig(configPath);
			expect(result.GITHUB_TOKEN).toBe('second');
			expect(result.GITLAB_URL).toBe('https://gitlab.example.com');
		});
	});

	it('損毀的 JSON 回傳空物件', () => {
		fs.writeFileSync(configPath, 'not-json', 'utf-8');
		expect(readConfig(configPath)).toEqual({});
	});
});
