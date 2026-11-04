import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Braces,
  ChartColumn,
  ClipboardPaste,
  Eraser,
  PanelBottom,
  Plus,
  SquareArrowOutUpRight,
  Table2,
  X
} from 'lucide-react'
import { defaultPageTitle } from '@shared/titles'
import { ICON_ACCENT } from '@shared/icons'
import { PAGE_TYPES } from '@shared/page-types'
import type { Page } from '@shared/api'
import { useWorkspace } from '@/lib/workspace'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import { CodeEditor } from '@/components/code-editor'
import { createDebouncer, type DebouncedSave } from '@/lib/debounced-save'
import { jumpTo, replaceDoc } from '@/lib/editor-jump'
import { undoWrite } from '@/lib/undo-write'
import { resolveJsonFormat, resolveJsonPaste } from '@/lib/json-actions'
import { useJsonPreview } from '@/lib/json-preview'
import { clearError, errorText, showError, showUndo } from '@/lib/notify'
import { CsvChart } from '@/components/csv-chart'
import { CsvEditor } from '@/components/csv-editor'
import { IconBadge, IconPicker } from '@/components/icon-picker'
import { MarkdownEditor } from '@/components/markdown-editor'
import { DeskBlotter } from '@/components/desk-blotter'
import { isDeskPageId } from '@/lib/desk'
import { isGuidePageId } from '@/lib/guide'
import { parseBlockPageId } from '@/lib/run-block'
import { loadChartSpec, saveChartSpec, type ChartSpec } from '@/lib/chart-data'
import { clearRunDraft, setRunDraft } from '@/lib/run-drafts'
import { useRunPage } from '@/lib/run-page'
import { PageHeader } from '@/components/page-header'
import { RunButton } from '@/components/run-button'
import { cn } from '@/lib/utils'
import { EditorBar, EditorBarButton, Segmented } from '@/components/editor-bar'
import { PageActions } from '@/components/page-actions'
import { RunOutput } from '@/components/run-output'
import { useSavedFlash } from '@/components/saved-flash'
import { usePopoutOutput } from '@/lib/output-popout'

function descriptionHasText(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as {
      content?: Array<{ content?: Array<{ text?: string }> }>
    }
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

function useDebouncedSaver(
  pageId: string,
  save: (id: string, content: string) => Promise<void>
): DebouncedSave {
  const debouncer = useMemo(() => createDebouncer(400), [])
  // Leaving the page (or switching it) saves what is pending instead of dropping it.
  useEffect(() => () => debouncer.flush(), [debouncer, pageId])
  return Object.assign((content: string) => debouncer.run(() => void save(pageId, content)), {
    cancel: debouncer.cancel
  })
}

function PagePane({ page, active }: { page: Page; active: boolean }): React.JSX.Element {
  const {
    renamePage,
    savePageContent,
    savePageDescription,
    updatePageAppearance,
    changePageType,
    preserveEditorFocus,
    pagesById,
    selectPage,
    saveBlockContent,
    flushSave,
    createPage
  } = useWorkspace()
  const { flash } = useSavedFlash()
  const preview = useJsonPreview()
  const jsonViewRef = useRef<EditorView | null>(null)
  const [title, setTitle] = useState(page.title)
  const [source, setSource] = useState(page.content)
  const sourceRef = useRef(source)
  useEffect(() => {
    sourceRef.current = source
  }, [source])
  const runner = useRunPage({ tabId: page.id, shared: true })
  const { run, running } = runner
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
    clearRunDraft(id, content)
  })
  const saveDescription = useDebouncedSaver(page.id, savePageDescription)

  const writeJson = useCallback(
    (next: string, message: string) => {
      const previous = source
      setSource(next)
      replaceDoc(jsonViewRef.current, next)
      saveContent(next)
      clearError()
      showUndo(message, async () => {
        let done: boolean
        try {
          done = await undoWrite({
            current: () => jsonViewRef.current?.state.doc.toString() ?? sourceRef.current,
            applied: next,
            previous,
            // Drop the pending save of `next`, or it lands after this and redoes the change.
            cancelPending: saveContent.cancel,
            apply: (text) => {
              setSource(text)
              replaceDoc(jsonViewRef.current, text)
            },
            save: (text) => savePageContent(page.id, text)
          })
        } catch (cause) {
          showError(errorText(cause, 'Could not undo'))
          return
        }
        if (!done) toast.info('Not undone: the page has changed since.')
      })
    },
    [page.id, saveContent, savePageContent, source]
  )

  const pasteJson = useCallback(async () => {
    let raw: string
    try {
      raw = await navigator.clipboard.readText()
    } catch (cause) {
      showError(errorText(cause, 'Could not read the clipboard'))
      return
    }
    const next = await resolveJsonPaste(raw, preview, {
      onCsv: (csv) => {
        void createPage(page.spaceId, 'csv', defaultPageTitle('csv'), csv).catch((cause) =>
          showError(errorText(cause, 'Could not make a table'))
        )
      },
      onText: (text) => writeJson(text, 'Pasted as text')
    })
    if (next != null) writeJson(next.text, next.asText ? 'Pasted as text' : 'Pasted JSON')
  }, [createPage, page.spaceId, preview, writeJson])

  const formatJson = useCallback(async () => {
    const next = await resolveJsonFormat(source, preview, (offset) =>
      jumpTo(jsonViewRef.current, offset)
    )
    if (next != null) writeJson(next, 'Formatted JSON')
  }, [preview, source, writeJson])
  const locked = isGuidePageId(page.id) || page.locked
  const isCode = page.type === 'javascript' || page.type === 'typescript'
  const language = page.type === 'typescript' ? 'typescript' : 'javascript'
  const isCsv = page.type === 'csv'
  const isJson = page.type === 'json'
  const toolPage = PAGE_TYPES[page.type].kind !== 'markdown'
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

  const output = usePopoutOutput(
    {
      key: page.id,
      title,
      accent: page.iconColor,
      run,
      running
    },
    runner.clear
  )

  const { execute } = runner
  const onRun = useCallback(async () => {
    if (page.type !== 'javascript' && page.type !== 'typescript') return
    await execute({
      language: page.type,
      source,
      spaceId: page.spaceId,
      pageId: blockRef?.pageId ?? page.id
    })
  }, [blockRef?.pageId, execute, page.id, page.spaceId, page.type, source])

  useEffect(() => () => clearRunDraft(page.id), [page.id])

  return (
    <article
      className="accent-select flex h-full min-h-0 flex-col select-text"
      style={{ '--page-accent': ICON_ACCENT[page.iconColor] } as React.CSSProperties}
    >
      <PageHeader
        wide={toolPage}
        icon={
          locked || blockRef ? (
            <IconBadge icon={page.icon} color={page.iconColor} className="size-9" />
          ) : (
            <IconPicker
              icon={page.icon}
              color={page.iconColor}
              size="lg"
              onChange={(appearance) => void updatePageAppearance(page.id, appearance)}
            />
          )
        }
        breadcrumb={
          blockRef ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
              onClick={() => void selectPage(blockRef.pageId, page.spaceId)}
            >
              <ArrowLeft className="size-3.5" />
              {parentPage?.title || 'Back'}
            </button>
          ) : null
        }
        title={
          blockRef || locked ? (
            <h1 className="w-full truncate text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em]">
              {page.title}
            </h1>
          ) : (
            <input
              value={title}
              aria-label="Page title"
              className="w-full min-w-0 bg-transparent text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em] outline-none placeholder:text-muted-foreground/70"
              placeholder="Untitled"
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                const next = title.trim()
                if (next && next !== page.title) void renamePage(page.id, next)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                event.currentTarget.blur()
              }}
            />
          )
        }
        actions={blockRef || isGuidePageId(page.id) ? null : <PageActions page={page} />}
        state={
          toolPage && !blockRef ? (
            <DescriptionField
              content={page.description}
              onChange={(description) => saveDescription(description)}
            />
          ) : null
        }
      />

      {page.type === 'markdown' ? (
        <div className="min-h-0 w-full max-w-3xl flex-1 overflow-auto px-10 pr-12 pb-8">
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
          <EditorBar type="csv">
            <Segmented
              value={csvView}
              options={[
                { id: 'table', label: 'Table', icon: Table2 },
                { id: 'chart', label: 'Chart', icon: ChartColumn }
              ]}
              onChange={(id) => {
                setCsvView(id)
                window.localStorage.setItem(`paper.csvView.${page.id}`, id)
              }}
            />
          </EditorBar>
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

      {isJson ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border/50">
          <EditorBar type="json">
            <EditorBarButton
              className="text-muted-foreground"
              disabled={page.locked}
              aria-label="Paste JSON from clipboard"
              onClick={() => void pasteJson()}
            >
              <ClipboardPaste className="size-3.5" />
              Paste
            </EditorBarButton>
            <EditorBarButton
              className="text-muted-foreground"
              disabled={page.locked}
              aria-label="Format JSON"
              onClick={() => void formatJson()}
            >
              <Braces className="size-3.5" />
              Format
            </EditorBarButton>
          </EditorBar>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <CodeEditor
              active={active}
              accent={page.iconColor}
              restoreFocus={active && preserveEditorFocus}
              value={source}
              readOnly={page.locked}
              language="json"
              onFormat={() => void formatJson()}
              onEditorView={(view) => {
                jsonViewRef.current = view
              }}
              onChange={(content) => {
                setSource(content)
                saveContent(content)
              }}
            />
            {!source.trim() ? (
              <EmptyState
                icon={Braces}
                className="pointer-events-none absolute inset-0"
                action={
                  page.locked ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="pointer-events-auto"
                      onClick={() => void pasteJson()}
                    >
                      <ClipboardPaste className="size-3.5" />
                      Paste JSON
                    </Button>
                  )
                }
              >
                This JSON page is empty. Type or paste some JSON.
              </EmptyState>
            ) : null}
          </div>
        </div>
      ) : null}

      {isCode ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <EditorBar type={language} className="border-t">
            <Segmented
              label="Language"
              value={language}
              options={[
                { id: 'javascript', label: 'JavaScript' },
                { id: 'typescript', label: 'TypeScript' }
              ]}
              disabled={blockRef ? isGuidePageId(blockRef.pageId) : locked}
              onChange={(id) =>
                void (blockRef
                  ? saveBlockContent(blockRef.pageId, blockRef.blockId, { language: id })
                  : changePageType(page.id, id))
              }
            />
            <RunButton
              accent={page.iconColor}
              running={running}
              shortcut
              onRun={() => void onRun()}
            />
          </EditorBar>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeEditor
              active={active}
              accent={page.iconColor}
              restoreFocus={active && preserveEditorFocus}
              onRun={() => void onRun()}
              value={source}
              readOnly={Boolean(blockRef && isGuidePageId(blockRef.pageId)) || page.locked}
              language={language}
              onChange={(content) => {
                setSource(content)
                if (!blockRef) setRunDraft(page.id, content)
                saveContent(content)
              }}
            />
          </div>
          {output.popped ? (
            <section className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-sidebar/50 px-4">
              <p className="text-[12px] text-muted-foreground">Output is in its own window.</p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground [&_svg]:size-3.5"
                  aria-label="Show output window"
                  onClick={output.show}
                >
                  <SquareArrowOutUpRight />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground [&_svg]:size-3.5"
                  aria-label="Dock output"
                  onClick={output.dock}
                >
                  <PanelBottom />
                </Button>
              </div>
            </section>
          ) : (
            <>
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
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground [&_svg]:size-3.5"
                      aria-label="Pop out output"
                      onClick={output.pop}
                    >
                      <SquareArrowOutUpRight />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground [&_svg]:size-3.5"
                      aria-label="Clear output"
                      onClick={runner.clear}
                    >
                      <Eraser />
                    </Button>
                  </div>
                </div>
                {!run ? (
                  <p className="font-mono text-sm text-muted-foreground">
                    Run the snippet to see logs here.
                  </p>
                ) : (
                  <RunOutput run={run} />
                )}
              </section>
            </>
          )}
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
