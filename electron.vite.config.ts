import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sandboxPrelude } from './src/main/sandbox/build-prelude'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), sandboxPrelude()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'run-host': resolve('src/main/run-host.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Sandboxed preloads must be CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
