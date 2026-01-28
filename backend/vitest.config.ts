// Vitest Configuration
// Testing configuration for backend unit and integration tests

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 使用測試專用的 TypeScript 配置
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        esModuleInterop: true,
        strict: true,
      },
    },
  },
  test: {
    // Use Node.js environment for backend tests
    environment: 'node',

    // Test file patterns
    include: ['tests/**/*.test.ts'],

    // Global test configuration
    globals: true,

    // Global setup (teardown 函數也在同一檔案中)
    globalSetup: ['./tests/setup/globalSetup.ts'],

    // Setup files to run before each test file
    setupFiles: ['./tests/setup/testConfig.ts'],

    // Environment variables for testing
    env: {
      ANTHROPIC_API_KEY: 'sk-ant-test-key-for-testing-only',
      NODE_ENV: 'test',
      WORKSPACE_ROOT: '/tmp/test-workspaces',
      PORT: '3001',
      CORS_ORIGIN: 'http://localhost:5173',
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },

    // Test timeout
    testTimeout: 10000,
  },
});
