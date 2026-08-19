import { useEffect, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Copy,
  CopyPlus,
  History,
  Lock,
  LockOpen,
  MoreHorizontal,
  SpellCheck,
  Trash2
} from 'lucide-react'
import type { Page, PageVersion, RunRecord } from '@shared/api'
import { api } from '@/lib/rpc'
import { isGuidePageId } from '@/lib/guide'
import { isBlockPageId } from '@/lib/run-block'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useWorkspace } from '@/lib/workspace'
import { RunOutput } from '@/components/run-output'

export function PageActions({ page }: { page: Page }): React.JSX.Element | null {
  const {
    duplicatePage,
    archivePage,
    unarchivePage,
    deletePage,
    updatePageFlags,
    restorePageVersion
  } = useWorkspace()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [runsOpen, setRunsOpen] = useState(false)
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const lockedPage = isGuidePageId(page.id) || isBlockPageId(page.id)
  const isCode = page.type === 'javascript' || page.type === 'typescript'

  useEffect(() => {
    if (!historyOpen) return
    void api.pages.listVersions({ id: page.id }).then(setVersions)
  }, [historyOpen, page.id])

  useEffect(() => {
    if (!runsOpen) return
    void api.pages.listRuns({ id: page.id }).then((next) => {
      setRuns(next)
      setSelectedRunId(next[0]?.id ?? null)
    })
  }, [runsOpen, page.id])

  if (lockedPage) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Page">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void duplicatePage(page.id)}>
            <CopyPlus className="size-3.5" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void navigator.clipboard.writeText(page.content)}
          >
            <Copy className="size-3.5" />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void updatePageFlags(page.id, { locked: !page.locked })}
          >
            {page.locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
            {page.locked ? 'Unlock page' : 'Lock page'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void updatePageFlags(page.id, { spellcheck: !page.spellcheck })}
          >
            <SpellCheck className="size-3.5" />
            {page.spellcheck ? 'Disable spellcheck' : 'Enable spellcheck'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
            <History className="size-3.5" />
            Version history
          </DropdownMenuItem>
          {isCode ? (
            <DropdownMenuItem onSelect={() => setRunsOpen(true)}>
              <History className="size-3.5" />
              Run history
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {page.archived ? (
            <DropdownMenuItem onSelect={() => void unarchivePage(page.id)}>
              <ArchiveRestore className="size-3.5" />
              Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void archivePage(page.id)}>
              <Archive className="size-3.5" />
              Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void deletePage(page.id)}
          >
            <Trash2 className="size-3.5" />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>Snapshots from saves. Restore replaces the current page.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 max-h-[60vh] overflow-auto">
            {versions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No snapshots yet.</p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between gap-2 border-b border-border/50 py-2"
                >
                  <div>
                    <p className="text-sm">{version.title || 'Untitled'}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void restorePageVersion(page.id, version.id).then(() => {
                        setHistoryOpen(false)
                      })
                    }}
                  >
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={runsOpen} onOpenChange={setRunsOpen}>
        <DialogContent className="flex h-[min(36rem,calc(100vh-4rem))] w-[min(52rem,calc(100vw-2rem))] flex-col overflow-hidden p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle>Run history</DialogTitle>
            <DialogDescription>Pick a run to see its source and output.</DialogDescription>
          </DialogHeader>
          {runs.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No runs yet.
            </p>
          ) : (
            <div className="flex min-h-0 flex-1">
              <aside className="w-52 shrink-0 overflow-auto border-r border-border/60">
                {runs.map((record) => {
                  const active = record.id === selectedRunId
                  const when = new Date(record.createdAt)
                  return (
                    <button
                      key={record.id}
                      type="button"
                      className={
                        active
                          ? 'flex w-full flex-col items-start gap-0.5 bg-accent px-3 py-2.5 text-left'
                          : 'flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-accent/70'
                      }
                      onClick={() => setSelectedRunId(record.id)}
                    >
                      <span className="text-[13px]">{when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {when.toLocaleDateString()}
                        {record.error ? ' · error' : ''}
                      </span>
                    </button>
                  )
                })}
              </aside>
              <div className="min-w-0 flex-1 overflow-auto p-4">
                {(() => {
                  const record = runs.find((item) => item.id === selectedRunId) ?? runs[0]
                  if (!record) return null
                  return (
                    <div className="flex flex-col gap-3">
                      <p className="text-[12px] text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString()}
                      </p>
                      <pre className="max-h-40 overflow-auto rounded-md border border-border/60 bg-sidebar/40 p-3 font-mono text-[11px] text-ink-soft">
                        {record.source}
                      </pre>
                      <div className="rounded-md border border-border/60 bg-sidebar/30">
                        <RunOutput
                          run={{
                            logs: record.logs,
                            result: record.result,
                            error: record.error
                          }}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
