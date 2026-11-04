/** A save that waits for a pause in edits; `cancel` drops the pending one. */
export type DebouncedSave = ((content: string) => void) & { cancel: () => void }

/**
 * Runs the latest task `delay` ms after the last `run`. `cancel` drops a pending task; `flush`
 * runs it now.
 */
export type Debouncer = {
  run: (task: () => void) => void
  cancel: () => void
  flush: () => void
}

/**
 * A debouncer for saves: only the latest task runs, `delay` ms after the last call. Call `cancel`
 * before writing content another way (for example Undo) so a pending save can't land afterwards
 * and overwrite it.
 */
export function createDebouncer(delay = 400): Debouncer {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: (() => void) | null = null
  const cancel = (): void => {
    if (timer) clearTimeout(timer)
    timer = null
    pending = null
  }
  const flush = (): void => {
    const task = pending
    cancel()
    task?.()
  }
  return {
    cancel,
    flush,
    run: (task) => {
      cancel()
      pending = task
      timer = setTimeout(flush, delay)
    }
  }
}
