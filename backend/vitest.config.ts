// Vitest Configuration
// Testing configuration for backend unit and integration tests

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use Node.js environment for backend tests
    environment: 'node',

    // Test file patterns
    include: ['tests/**/*.test.ts'],

    // Global test configuration
    globals: true,

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
