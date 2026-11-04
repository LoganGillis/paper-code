import { parentPort } from 'node:worker_threads'
import { executeSnippet, type RunContext } from './runner'
import { cloneableResult } from './run-serialize'

type Request = {
  language: 'javascript' | 'typescript'
  source: string
  context: RunContext
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function reply(payload: unknown): void {
  try {
    parentPort?.postMessage(payload)
  } catch (cause) {
    parentPort?.postMessage({
      ok: false,
      error: `Could not send the result back (${message(cause)})`
    })
  }
}

parentPort?.once('message', (request: Request) => {
  void executeSnippet(request.language, request.source, request.context).then(
    (result) => reply({ ok: true, result: cloneableResult(result) }),
    (error: unknown) => reply({ ok: false, error: message(error) })
  )
})
