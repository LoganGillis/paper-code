import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChartColumn, Play, Plus, Table2, X } from 'lucide-react'
import { ICON_ACCENT } from '@shared/icons'
import type { Page, RunResult } from '@shared/api'
import { api } from '@/lib/rpc'
import { useWorkspace } from '@/lib/workspace'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { CodeEditor } from '@/components/code-editor'
import { CsvChart } from '@/components/csv-chart'
import { CsvEditor } from '@/components/csv-editor'
import { IconBadge, IconPicker } from '@/components/icon-picker'
import { MarkdownEditor } from '@/components/markdown-editor'
import { DeskBlotter } from '@/components/desk-blotter'
import { isDeskPageId } from '@/lib/desk'
import { isGuidePageId } from '@/lib/guide'
import { parseBlockPageId } from '@/lib/run-block'
import { loadChartSpec, saveChartSpec, type ChartSpec } from '@/lib/chart-data'
import { RUN_ACCENT } from '@/lib/run-accent'
import { cn } from '@/lib/utils'
import { modSymbol } from '@/lib/platform'
import { PageActions } from '@/components/page-actions'
import { RunOutput } from '@/components/run-output'
import { useSavedFlash } from '@/components/saved-flash'

function descriptionHasText(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { content?: Array<{ content?: Array<{ text?: string }> }> }
    const text = (parsed.content ?? [])
      .flatMap((node) => node.content ?? [])
      .map((node) => node.text ?? '')
      .join('')
    return text.trim().length > 0
  } catch {
    return content.trim().length > 0
  }
}

function DescriptionField({
  content,
  onChange
}: {
  content: string
  onChange: (value: string) => void
}): React.JSX.Element {
  const filled = descriptionHasText(content)
  const [open, setOpen] = useState(filled)
  const [draft, setDraft] = useState(content)
  const [shouldFocus, setShouldFocus] = useState(false)

  useEffect(() => {
    setDraft(content)
    if (descriptionHasText(content)) setOpen(true)
  }, [content])

  if (!open) {
    return (
      <button
        type="button"
        className="text-[13px] text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:text-foreground"
        onClick={() => {
          setShouldFocus(true)
          setOpen(true)
        }}
      >
        <span className="inline-flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Plus className="size-3" />
          Add a description
        </span>
      </button>
    )
  }
  return (
    <div
      className="text-muted-foreground"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        if (!descriptionHasText(draft)) {
          setShouldFocus(false)
          setOpen(false)
        }
      }}
    >
      <MarkdownEditor
        content={content}
        compact
        restoreFocus={shouldFocus}
        placeholder="Add a description or instructions"
        onChange={(value) => {
          setDraft(value)
          onChange(value)
        }}
      />
    </div>
  )
}

function useDebouncedSaver(pageId: string, save: (id: string, content: string) => Promise<void>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pageId])

  return (content: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void save(pageId, content)
    }, 400)
  }
}

function PagePane({ page, active }: { page: Page; active: boolean }): React.JSX.Element {
  const {
    renamePage,
    savePageContent,
    savePageDescription,
    updatePageAppearance,
    changePageType,
    runningPageIds,
    setPageRunning,
    preserveEditorFocus,
    pagesById,
    selectPage,
    saveBlockContent,
    flushSave
  } = useWorkspace()
  const { flash } = useSavedFlash()
  const [title, setTitle] = useState(page.title)
  const [source, setSource] = useState(page.content)
  const [run, setRun] = useState<RunResult | null>(null)
  const running = runningPageIds.includes(page.id)
  const [consoleHeight, setConsoleHeight] = useState(() => {
    const stored = Number(window.localStorage.getItem('paper.consoleHeight'))
    return Number.isFinite(stored) && stored >= 88 ? stored : 144
  })
  const blockRef = parseBlockPageId(page.id)
  const parentPage = blockRef ? (pagesById[blockRef.pageId] ?? null) : null
  const saveContent = useDebouncedSaver(page.id, async (id, content) => {
    if (blockRef) {
      await saveBlockContent(blockRef.pageId, blockRef.blockId, { source: content })
      return
    }
    await savePageContent(id, content)
  })
  const saveDescription = useDebouncedSaver(page.id, savePageDescription)
  const locked = isGuidePageId(page.id) || page.locked
  const isCode = page.type === 'javascript' || page.type === 'typescript'
  const isCsv = page.type === 'csv'
  const [csvView, setCsvView] = useState<'table' | 'chart'>(() =>
    window.localStorage.getItem(`paper.csvView.${page.id}`) === 'chart' ? 'chart' : 'table'
  )
  const [chartSpec, setChartSpec] = useState<ChartSpec | null>(() => loadChartSpec(page.id))

  useEffect(() => {
    setTitle(page.title)
  }, [page.title])

  useEffect(() => {
    setSource(page.content)
  }, [page.id, page.content])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() !== 's') return
      event.preventDefault()
      if (isGuidePageId(page.id) || blockRef) return
      void flushSave(page.id).then(() => flash())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, blockRef, flash, flushSave, page.id])

  const onRun = useCallback(async () => {
    if (page.type !== 'javascript' && page.type !== 'typescript') return
    setPageRunning(page.id, true)
    try {
      setRun(
        await api.run.execute({
          language: page.type,
          source,
          spaceId: page.spaceId,
          pageId: blockRef?.pageId ?? page.id
        })
      )
    } finally {
      setPageRunning(page.id, false)
    }
  }, [blockRef?.pageId, page.id, page.spaceId, page.type, setPageRunning, source])

  return (
    <article
      className="accent-select flex h-full min-h-0 flex-col select-text"
      style={{ '--page-accent': ICON_ACCENT[page.iconColor] } as React.CSSProperties}
    >
      <header
        className={cn(
          'group shrink-0',
          isCode || isCsv ? 'px-6 pt-6 pb-3' : 'mx-auto w-full max-w-3xl px-10 pt-10 pb-4'
        )}
      >
        <div className="mb-3 flex items-center gap-3">
          {locked || blockRef ? (
            <IconBadge icon={page.icon} color={page.iconColor} className="size-9" />
          ) : (
            <IconPicker
              icon={page.icon}
              color={page.iconColor}
              size="lg"
              onChange={(appearance) => void updatePageAppearance(page.id, appearance)}
            />
          )}
          {blockRef ? (
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="mb-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
                onClick={() => void selectPage(blockRef.pageId, page.spaceId)}
              >
                <ArrowLeft className="size-3.5" />
                {parentPage?.title || 'Back'}
              </button>
              <h1 className="w-full truncate text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em]">
                {page.title}
              </h1>
            </div>
          ) : locked ? (
            <h1 className="min-w-0 flex-1 text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em]">
              {page.title}
            </h1>
          ) : (
            <input
              value={title}
              aria-label="Page title"
              className="min-w-0 flex-1 bg-transparent text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em] outline-none placeholder:text-muted-foreground/70"
              placeholder="Untitled"
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                const next = title.trim()
                if (next && next !== page.title) void renamePage(page.id, next)
              }}
            />
          )}
          {blockRef || isGuidePageId(page.id) ? null : <PageActions page={page} />}
        </div>
        {(isCode || isCsv) && !blockRef ? (
          <DescriptionField
            content={page.description}
            onChange={(description) => saveDescription(description)}
          />
        ) : null}
      </header>

      {page.type === 'markdown' ? (
        <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-auto px-10 pr-12 pb-8">
          <MarkdownEditor
            content={page.content}
            restoreFocus={active && preserveEditorFocus}
            pageId={page.id}
            spaceId={page.spaceId}
            readOnly={locked}
            spellcheck={page.spellcheck}
            placeholder={locked ? '' : undefined}
            onChange={(content) => saveContent(content)}
            active={active}
          />
        </div>
      ) : null}

      {isCsv ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border/50">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              csv
            </p>
            <div className="flex rounded-md bg-sidebar p-0.5">
              {(
                [
                  { id: 'table' as const, label: 'Table', icon: Table2 },
                  { id: 'chart' as const, label: 'Chart', icon: ChartColumn }
                ] as const
              ).map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-6 gap-1 px-2 text-[11px]',
                    csvView === item.id && 'bg-paper text-foreground shadow-sm'
                  )}
                  onClick={() => {
                    setCsvView(item.id)
                    window.localStorage.setItem(`paper.csvView.${page.id}`, item.id)
                  }}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          {csvView === 'table' ? (
            <CsvEditor
              active={active}
              content={source || page.content}
              onChange={(next) => {
                setSource(next)
                saveContent(next)
              }}
            />
          ) : (
            <CsvChart
              content={source || page.content}
              spec={chartSpec ?? undefined}
              accent={page.iconColor}
              height={320}
              onSpecChange={(next) => {
                setChartSpec(next)
                saveChartSpec(page.id, next)
              }}
            />
          )}
        </div>
      ) : null}

      {isCode ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
            <div className="flex rounded-sm bg-sidebar p-0.5">
              {(['javascript', 'typescript'] as const).map((id) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-6 rounded-sm px-2 text-[11px]',
                    page.type === id && 'bg-paper text-foreground shadow-sm'
                  )}
                  disabled={Boolean(blockRef && isGuidePageId(blockRef.pageId))}
                  onClick={() => {
                    if (page.type === id) return
                    if (blockRef) {
                      void saveBlockContent(blockRef.pageId, blockRef.blockId, { language: id })
                      return
                    }
                    void changePageType(page.id, id)
                  }}
                >
                  {id === 'javascript' ? 'JavaScript' : 'TypeScript'}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              className={cn('shadow-none', RUN_ACCENT[page.iconColor])}
              onClick={() => void onRun()}
              disabled={running}
            >
              <Play />
              {running ? 'Running' : 'Run'}
              <KbdGroup className="ml-1 opacity-80">
                <Kbd className="bg-current/15 text-current">{modSymbol()}</Kbd>
                <Kbd className="bg-current/15 text-current">↵</Kbd>
              </KbdGroup>
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden border-t border-border/60">
            <CodeEditor
              active={active}
              accent={page.iconColor}
              restoreFocus={active && preserveEditorFocus}
              onRun={() => void onRun()}
              value={source}
              readOnly={Boolean(blockRef && isGuidePageId(blockRef.pageId)) || page.locked}
              language={page.type === 'typescript' ? 'typescript' : 'javascript'}
              onChange={(content) => {
                setSource(content)
                saveContent(content)
              }}
            />
          </div>
          <div
            className="console-resizer shrink-0"
            onMouseDown={(event) => {
              event.preventDefault()
              const startY = event.clientY
              const startH = consoleHeight
              const onMove = (move: MouseEvent): void => {
                const next = Math.min(420, Math.max(88, startH + (startY - move.clientY)))
                setConsoleHeight(next)
                window.localStorage.setItem('paper.consoleHeight', String(next))
              }
              const onUp = (): void => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          />
          <section
            className="shrink-0 overflow-auto bg-sidebar/50 px-4 py-2 shadow-[inset_0_10px_12px_-12px_rgb(0_0_0/0.28)] select-text"
            style={{ height: consoleHeight }}
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                Output
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setRun(null)}
              >
                Clear
              </Button>
            </div>
            {!run ? (
              <p className="font-mono text-sm text-muted-foreground">
                Run the snippet to see logs here.
              </p>
            ) : (
              <RunOutput run={run} />
            )}
          </section>
        </div>
      ) : null}
    </article>
  )
}

export function PageView(): React.JSX.Element {
  const { tabs, page, pagesById, beside, closeBeside, paneFocus, setPaneFocus } = useWorkspace()
  const [besideWidth, setBesideWidth] = useState(() => {
    const stored = Number(window.localStorage.getItem('paper.besideWidth'))
    return Number.isFinite(stored) && stored >= 280 ? stored : 420
  })
  const besidePage = beside ? pagesById[beside.pageId] : null

  if (tabs.length === 0) {
    return <DeskBlotter active />
  }

  const main = (
    <div className="relative min-h-0 min-w-0 flex-1" onMouseDown={() => setPaneFocus('main')}>
      {tabs.map((tab) => {
        const tabPage = pagesById[tab.pageId]
        if (!tabPage && !isDeskPageId(tab.pageId)) return null
        if (beside?.pageId === tab.pageId && page?.id !== tab.pageId) return null
        const active = page?.id === tab.pageId
        return (
          <div
            key={tab.pageId}
            className={cn('absolute inset-0 min-h-0 bg-paper', active ? 'z-10' : 'hidden')}
            aria-hidden={!active}
          >
            {isDeskPageId(tab.pageId) ? (
              <DeskBlotter active={active && paneFocus === 'main'} />
            ) : tabPage ? (
              <PagePane page={tabPage} active={active && paneFocus === 'main'} />
            ) : null}
          </div>
        )
      })}
    </div>
  )

  if (!beside || !besidePage) return <div className="flex h-full min-w-0">{main}</div>

  return (
    <div className="flex h-full min-w-0">
      {main}
      <div
        role="separator"
        aria-orientation="vertical"
        className="w-1.5 shrink-0 cursor-col-resize bg-border/50 hover:bg-foreground/15"
        onMouseDown={(event) => {
          event.preventDefault()
          const startX = event.clientX
          const startW = besideWidth
          const onMove = (move: MouseEvent): void => {
            const next = Math.min(720, Math.max(280, startW - (move.clientX - startX)))
            setBesideWidth(next)
            window.localStorage.setItem('paper.besideWidth', String(next))
          }
          const onUp = (): void => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      />
      <div
        className="relative min-h-0 shrink-0 overflow-hidden border-l border-border/60 bg-paper"
        style={{ width: besideWidth }}
        onMouseDown={() => setPaneFocus('beside')}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-20 size-7"
          aria-label="Close beside"
          onClick={() => closeBeside()}
        >
          <X className="size-3.5" />
        </Button>
        <PagePane page={besidePage} active={paneFocus === 'beside'} />
      </div>
    </div>
  )
}
