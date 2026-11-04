import { parentPort } from 'node:worker_threads'
import type { Page } from '../shared/api'
import { executeSnippet } from './runner'

type Request = {
  language: 'javascript' | 'typescript'
  source: string
  context: {
    page: Page
    pages: Page[]
    spaces?: Array<{ id: string; name: string }>
    secrets?: Record<string, string>
  }
}

parentPort?.on('message', (message: Request) => {
  void executeSnippet(message.language, message.source, message.context).then(
    (result) => parentPort?.postMessage({ ok: true, result }),
    (error: unknown) =>
      parentPort?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
  )
})
