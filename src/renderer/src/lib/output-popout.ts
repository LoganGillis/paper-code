import { useEffect, useRef, useState } from 'react'
import type { OutputSnapshot } from '@shared/api'

export function usePopoutOutput(
  snapshot: OutputSnapshot,
  onClear: () => void
): {
  popped: boolean
  pop: () => void
  show: () => void
  dock: () => void
} {
  const [popped, setPopped] = useState(false)
  const snapshotRef = useRef(snapshot)
  const onClearRef = useRef(onClear)

  useEffect(() => {
    snapshotRef.current = snapshot
    onClearRef.current = onClear
  })

  useEffect(() => {
    let cancelled = false
    void window.api.outputIsOpen(snapshot.key).then((open) => {
      if (!cancelled && open) setPopped(true)
    })
    const offClosed = window.api.onOutputClosed((key) => {
      if (key === snapshotRef.current.key) setPopped(false)
    })
    const offCleared = window.api.onOutputCleared((key) => {
      if (key === snapshotRef.current.key) onClearRef.current()
    })
    return () => {
      cancelled = true
      offClosed()
      offCleared()
    }
  }, [snapshot.key])

  useEffect(() => {
    if (!popped) return
    window.api.updateOutput(snapshotRef.current)
  }, [popped, snapshot.key, snapshot.title, snapshot.accent, snapshot.run, snapshot.running])

  const pop = (): void => {
    void window.api.openOutput(snapshotRef.current).then(() => setPopped(true))
  }
  const show = (): void => {
    void window.api.openOutput(snapshotRef.current)
  }
  const dock = (): void => {
    void window.api.dockOutput(snapshotRef.current.key)
  }

  return { popped, pop, show, dock }
}
