import { useCallback, useState } from 'react'
import type { PageType, RunResult } from '@shared/api'
import { api } from '@/lib/rpc'
import { errorText, showError } from '@/lib/notify'
import { useWorkspace } from '@/lib/workspace'

export type RunInput = {
  language: Extract<PageType, 'javascript' | 'typescript'>
  source: string
  spaceId: string
  pageId: string
}

/**
 * Shared state for every Run button. `tabId` is the page whose tab shows the spinner while
 * the script runs; with `shared`, runs started elsewhere for that page also count as running.
 */
export function useRunPage({ tabId, shared = false }: { tabId: string; shared?: boolean }): {
  run: RunResult | null
  running: boolean
  clear: () => void
  execute: (input: RunInput | (() => Promise<RunInput | null>)) => Promise<void>
} {
  const { runningPageIds, setPageRunning } = useWorkspace()
  const [run, setRun] = useState<RunResult | null>(null)
  const [local, setLocal] = useState(false)
  const running = local || (shared && Boolean(tabId) && runningPageIds.includes(tabId))

  const execute = useCallback(
    async (input: RunInput | (() => Promise<RunInput | null>)) => {
      setLocal(true)
      if (tabId) setPageRunning(tabId, true)
      try {
        const request = typeof input === 'function' ? await input() : input
        if (request) setRun(await api.run.execute(request))
      } catch (cause) {
        showError(errorText(cause, 'Could not run the script'))
      } finally {
        setLocal(false)
        if (tabId) setPageRunning(tabId, false)
      }
    },
    [setPageRunning, tabId]
  )

  return { run, running, clear: useCallback(() => setRun(null), []), execute }
}
