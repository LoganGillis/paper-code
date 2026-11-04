import { defineConfig } from 'vitest/config'
import { sandboxPrelude } from './src/main/sandbox/build-prelude'

export default defineConfig({
  plugins: [sandboxPrelude()],
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node'
  }
})
