import { useEffect, useState } from 'react'
import { Eraser, PanelBottom } from 'lucide-react'
import { ICON_ACCENT } from '@shared/icons'
import type { OutputSnapshot } from '@shared/api'
import { RunOutput } from '@/components/run-output'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { isMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

export function OutputApp(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<OutputSnapshot | null>(null)

  useEffect(() => {
    const offState = window.api.onOutputState(setSnapshot)
    const offClose = window.api.onCloseTab(() => window.api.closeWindow())
    void window.api.outputHello().then((next) => {
      if (next) setSnapshot(next)
    })
    return () => {
      offState()
      offClose()
    }
  }, [])

  useEffect(() => {
    const title = snapshot?.title?.trim() ? `Output — ${snapshot.title.trim()}` : 'Output'
    window.api.setTitle(`Paper - ${title}`)
  }, [snapshot?.title])

  const accent = snapshot ? ICON_ACCENT[snapshot.accent] : undefined
  const run = snapshot?.run ?? null
  const empty = !run || (run.logs.length === 0 && !run.result && !run.error)

  return (
    <div
      className="accent-select paper-page flex h-full min-h-0 flex-col"
      style={accent ? ({ '--page-accent': accent } as React.CSSProperties) : undefined}
    >
      <header
        className={cn(
          'tab-rail app-drag flex h-11 shrink-0 items-center gap-2 px-3',
          isMac() ? 'pl-[92px]' : 'pr-36'
        )}
      >
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Output</p>
        <p className="min-w-0 truncate text-[13px] font-medium">{snapshot?.title || 'Paper'}</p>
        {snapshot?.running ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
        <div className="app-no-drag ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground [&_svg]:size-3.5"
            aria-label="Clear"
            onClick={() => window.api.clearOutput()}
          >
            <Eraser />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground [&_svg]:size-3.5"
            aria-label="Dock"
            onClick={() => window.api.closeWindow()}
          >
            <PanelBottom />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {snapshot?.running && empty ? (
          <p className="px-8 py-10 font-mono text-sm text-muted-foreground">Running…</p>
        ) : empty ? (
          <p className="px-8 py-10 font-mono text-sm text-muted-foreground">
            Run the snippet to see logs here.
          </p>
        ) : run ? (
          <div className="px-5 py-4">
            <RunOutput run={run} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
