import { resolve } from 'node:path'
import { build } from 'esbuild'
import type { Plugin } from 'vite'

const ID = 'virtual:sandbox-prelude'
const RESOLVED = `\0${ID}`
const ENTRY = resolve('src/main/sandbox/prelude.ts')

/** Bundles the sandbox prelude into one script that runs inside the vm context. */
export async function buildPrelude(): Promise<{ code: string; inputs: string[] }> {
  const out = await build({
    entryPoints: [ENTRY],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'neutral',
    target: 'es2022',
    metafile: true,
    alias: { 'node:util': resolve('src/main/sandbox/inspect.ts') },
    logLevel: 'silent'
  })
  return { code: out.outputFiles[0].text, inputs: Object.keys(out.metafile.inputs) }
}

/** Vite plugin that serves the bundled prelude as `virtual:sandbox-prelude`. Build-time only. */
export function sandboxPrelude(): Plugin {
  return {
    name: 'paper-sandbox-prelude',
    resolveId(id) {
      return id === ID ? RESOLVED : null
    },
    async load(id) {
      if (id !== RESOLVED) return null
      const { code, inputs } = await buildPrelude()
      for (const input of inputs) this.addWatchFile(resolve(input))
      return `export default ${JSON.stringify(code)}`
    }
  }
}
