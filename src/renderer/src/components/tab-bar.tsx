import { useCallback, useEffect, useMemo, useRef } from 'react'
import { FileCode2, FileSpreadsheet, FileText, House, Plus, X } from 'lucide-react'
import type { Page, PageSummary, SpaceTree } from '@shared/api'
import { defaultPageTitle, displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { TypeBadge } from '@/components/type-badge'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { isDeskPageId } from '@/lib/desk'
import { isGuidePageId } from '@/lib/guide'
import { isMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'

export function TabBar(): React.JSX.Element {
  const {
    tabs,
    trees,
    page,
    pagesById,
    selectPage,
    closeTab,
    beside,
    paneFocus,
    setPaneFocus,
    closeBeside,
    runningPageIds,
    createPage,
    importCsv,
    spaceId,
    spaces
  } = useWorkspace()

  const lastClose = useRef(0)
  const requestClose = useCallback((): void => {
    const now = Date.now()
    if (now - lastClose.current < 80) return
    lastClose.current = now
    if (beside) {
      closeBeside()
      return
    }
    if (page && !isDeskPageId(page.id)) closeTab(page.id)
  }, [beside, closeBeside, closeTab, page])

  const visibleTabs = useMemo(
    () =>
      tabs.filter(
        (tab) =>
          isDeskPageId(tab.pageId) || tab.pageId !== beside?.pageId || tab.pageId === page?.id
      ),
    [beside?.pageId, page?.id, tabs]
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() === 'w') {
        event.preventDefault()
        requestClose()
        return
      }
      const match = /^Digit([1-9])$/.exec(event.code)
      const userTabs = visibleTabs.filter((tab) => !isDeskPageId(tab.pageId))
      if (!match || userTabs.length === 0) return
      event.preventDefault()
      const index = Number(match[1])
      const tab = index === 9 ? userTabs[userTabs.length - 1] : userTabs[index - 1]
      if (!tab) return
      setPaneFocus('main')
      void selectPage(tab.pageId, tab.spaceId)
    }
    window.addEventListener('keydown', onKey)
    const unsubscribe = window.api?.onCloseTab?.(() => {
      requestClose()
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      unsubscribe?.()
    }
  }, [requestClose, selectPage, setPaneFocus, visibleTabs])

  return (
    <div
      className={cn(
        'tab-rail app-drag flex h-11 shrink-0 items-center gap-1 overflow-x-auto px-3',
        !isMac() && 'pr-32'
      )}
    >
      {visibleTabs.map((tab, index) => {
        const pinned = isDeskPageId(tab.pageId)
        const summary = resolveSummary(tab.pageId, tab.spaceId, trees, pagesById)
        const isMain = page?.id === tab.pageId
        const split = isMain && beside && !pinned
        const besideSummary = split
          ? resolveSummary(beside.pageId, beside.spaceId, trees, pagesById)
          : undefined
        return (
          <span key={tab.pageId} className="flex items-center">
            {index === 1 ? <span className="mx-1 h-4 w-px bg-border/70" aria-hidden /> : null}
            {split ? (
              <div
                className="app-no-drag group flex h-7 max-w-[320px] items-center rounded-md bg-paper text-foreground shadow-sm"
                onAuxClick={(event) => {
                  if (event.button !== 1) return
                  event.preventDefault()
                  event.stopPropagation()
                  closeTab(tab.pageId)
                }}
              >
                <button
                  type="button"
                  aria-label={displayTitle(summary?.title ?? 'Untitled')}
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 py-0.5 pr-1.5 pl-2 text-[13px]',
                    paneFocus !== 'main' && 'opacity-50'
                  )}
                  onClick={() => setPaneFocus('main')}
                >
                  <TabGlyph summary={summary} running={runningPageIds.includes(tab.pageId)} />
                  <span className="truncate">{displayTitle(summary?.title ?? 'Untitled')}</span>
                </button>
                <span className="h-3.5 w-px shrink-0 bg-border/80" aria-hidden />
                <button
                  type="button"
                  aria-label={`${displayTitle(besideSummary?.title ?? 'Untitled')} beside`}
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 py-0.5 pr-1 pl-1.5 text-[13px]',
                    paneFocus !== 'beside' && 'opacity-50'
                  )}
                  onClick={() => setPaneFocus('beside')}
                >
                  <TabGlyph
                    summary={besideSummary}
                    running={runningPageIds.includes(beside.pageId)}
                  />
                  <span className="truncate">
                    {displayTitle(besideSummary?.title ?? 'Untitled')}
                  </span>
                </button>
                <span className="relative mr-1.5 flex size-4 shrink-0 items-center justify-center">
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label="Close tab"
                    className="flex size-4 items-center justify-center rounded-sm text-muted-foreground opacity-40 transition-opacity duration-150 hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      closeTab(tab.pageId)
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                aria-label={pinned ? 'Desk' : displayTitle(summary?.title ?? 'Untitled')}
                className={cn(
                  'app-no-drag group flex h-7 items-center rounded-md transition-colors duration-150',
                  pinned ? 'w-7 justify-center' : 'max-w-[200px] gap-1.5 px-2 text-[13px]',
                  pinned
                    ? isMain
                      ? 'text-foreground'
                      : 'text-ink-soft hover:text-foreground'
                    : isMain
                      ? 'bg-paper text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-paper/80 hover:text-foreground'
                )}
                onClick={() => {
                  setPaneFocus('main')
                  void selectPage(tab.pageId, tab.spaceId)
                }}
                onAuxClick={(event) => {
                  if (event.button !== 1 || pinned) return
                  event.preventDefault()
                  event.stopPropagation()
                  closeTab(tab.pageId)
                }}
              >
                {pinned ? (
                  <House className="size-4" strokeWidth={1.75} />
                ) : (
                  <>
                    <TabGlyph summary={summary} running={runningPageIds.includes(tab.pageId)} />
                    <span className="truncate">{displayTitle(summary?.title ?? 'Untitled')}</span>
                    <span className="relative flex size-4 shrink-0 items-center justify-center">
                      {summary ? (
                        <TypeBadge
                          type={summary.type}
                          className="pointer-events-none transition-opacity duration-150 group-hover:opacity-0"
                        />
                      ) : null}
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label="Close tab"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-sm opacity-0 transition-opacity duration-150 hover:bg-accent group-hover:pointer-events-auto group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation()
                          closeTab(tab.pageId)
                        }}
                      >
                        <X className="size-3" />
                      </span>
                    </span>
                  </>
                )}
              </button>
            )}
          </span>
        )
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="New"
            className="app-no-drag flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-paper/80 hover:text-foreground"
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => {
              const host = spaceId ?? spaces[0]?.id
              if (!host) return
              void createPage(host, 'markdown', defaultPageTitle('markdown'), undefined, {
                newTab: true
              })
            }}
          >
            <FileText className="size-3.5" />
            New page
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const host = spaceId ?? spaces[0]?.id
              if (!host) return
              void createPage(host, 'javascript', defaultPageTitle('javascript'), undefined, {
                newTab: true
              })
            }}
          >
            <FileCode2 className="size-3.5" />
            New JavaScript
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const host = spaceId ?? spaces[0]?.id
              if (!host) return
              void createPage(host, 'typescript', defaultPageTitle('typescript'), undefined, {
                newTab: true
              })
            }}
          >
            <FileCode2 className="size-3.5" />
            New TypeScript
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const host = spaceId ?? spaces[0]?.id
              if (!host) return
              void createPage(host, 'csv', defaultPageTitle('csv'), undefined, { newTab: true })
            }}
          >
            <FileSpreadsheet className="size-3.5" />
            New CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              const host = spaceId ?? spaces[0]?.id
              if (!host) return
              void importCsv(host, { newTab: true })
            }}
          >
            <FileSpreadsheet className="size-3.5" />
            Open CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TabGlyph({
  summary,
  running
}: {
  summary: PageSummary | undefined
  running: boolean
}): React.JSX.Element | null {
  if (running) {
    return (
      <span
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-md',
          summary ? `icon-chip icon-chip-${summary.iconColor}` : 'icon-chip icon-chip-slate'
        )}
      >
        <Spinner className="size-3" />
      </span>
    )
  }
  if (!summary) return null
  return <IconBadge icon={summary.icon} color={summary.iconColor} className="size-5" />
}

function resolveSummary(
  pageId: string,
  spaceId: string,
  trees: Record<string, SpaceTree>,
  pagesById: Record<string, Page>
): PageSummary | undefined {
  const tree = trees[spaceId]
  const cached = pagesById[pageId]
  return (
    tree?.pages.find((item) => item.id === pageId) ??
    findPage(tree?.folders ?? [], pageId) ??
    (cached
      ? cached
      : isGuidePageId(pageId)
        ? {
            id: pageId,
            title: 'Guide',
            type: 'markdown',
            folderId: null,
            sortOrder: 0,
            archived: false,
            icon: 'BookOpen',
            iconColor: 'slate',
            updatedAt: ''
          }
        : isDeskPageId(pageId)
          ? {
              id: pageId,
              title: 'Desk',
              type: 'markdown',
              folderId: null,
              sortOrder: 0,
              archived: false,
              icon: 'House',
              iconColor: 'slate',
              updatedAt: ''
            }
          : undefined)
  )
}

function findPage(
  folders: import('@shared/api').FolderNode[],
  pageId: string
): import('@shared/api').PageSummary | undefined {
  for (const folder of folders) {
    const match = folder.pages.find((page) => page.id === pageId)
    if (match) return match
    const nested = findPage(folder.folders, pageId)
    if (nested) return nested
  }
  return undefined
}
