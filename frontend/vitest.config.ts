import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['tests/setup.ts'],
      include: ['tests/**/*.test.ts'],
      reporters: ['verbose'],
      coverage: {
        provider: 'v8',
        include: [
          'src/stores/**/*.ts',
          'src/composables/**/*.ts',
          'src/services/**/*.ts',
          'src/utils/**/*.ts',
        ],
        exclude: [
          'tests/**',
          'src/types/**',
          'src/components/ui/**', // Shadcn UI 元件不測試
          'src/main.ts',
        ],
      },
    },
  })
)
