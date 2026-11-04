// Entry for the isolated script process (Electron utilityProcess). It only runs scripts; it has
// no database, window, or IPC access, and user code never sees its Node globals.
import prelude from 'virtual:sandbox-prelude'
import { runInSandbox } from './sandbox/host'
import type { RunRequest } from './sandbox/protocol'

const port = process.parentPort

port.once('message', (event: { data: RunRequest }) => {
  void runInSandbox(event.data, prelude).then(
    (result) => {
      try {
        port.postMessage({ ok: true, result })
      } catch (error) {
        port.postMessage({
          ok: false,
          error: `Could not send the result back (${error instanceof Error ? error.message : String(error)})`
        })
      }
    },
    (error: unknown) =>
      port.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) })
  )
})
