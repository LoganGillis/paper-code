import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { sandboxPrelude } from './src/main/sandbox/build-prelude'

export default defineConfig({
  plugins: [sandboxPrelude()],
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@': resolve('src/renderer/src')
    }
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node'
  }
})
