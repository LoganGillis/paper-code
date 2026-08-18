import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { PageSummary } from '@shared/api'
import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { TypeBadge } from '@/components/type-badge'
import { Spinner } from '@/components/ui/spinner'
import { isDeskPageId } from '@/lib/desk'
import { isGuidePageId } from '@/lib/guide'
import { isMac } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'

export function TabBar(): React.JSX.Element {
  const { tabs, trees, page, pagesById, selectPage, closeTab, runningPageIds } = useWorkspace()

  const lastClose = useRef(0)
  const requestClose = (): void => {
    const now = Date.now()
    if (now - lastClose.current < 80) return
    lastClose.current = now
    if (page) closeTab(page.id)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      if (event.key.toLowerCase() === 'w') {
        event.preventDefault()
        requestClose()
        return
      }
      const match = /^Digit([1-9])$/.exec(event.code)
      if (!match || tabs.length === 0) return
      event.preventDefault()
      const index = Number(match[1])
      const tab = index === 9 ? tabs[tabs.length - 1] : tabs[index - 1]
      if (tab) void selectPage(tab.pageId, tab.spaceId)
    }
    window.addEventListener('keydown', onKey)
    const unsubscribe = window.api?.onCloseTab?.(() => {
      requestClose()
    })
    return () => {
      window.removeEventListener('keydown', onKey)
      unsubscribe?.()
    }
  }, [closeTab, page, selectPage, tabs])

  return (
    <div
      className={cn(
        'tab-rail app-drag flex h-11 shrink-0 items-center gap-1 overflow-x-auto px-3',
        !isMac() && 'pr-32'
      )}
    >
      {tabs.map((tab) => {
        const tree = trees[tab.spaceId]
        const cached = pagesById[tab.pageId]
        const summary: PageSummary | undefined =
          tree?.pages.find((item) => item.id === tab.pageId) ??
          findPage(tree?.folders ?? [], tab.pageId) ??
          (cached
            ? cached
            : isGuidePageId(tab.pageId)
              ? {
                  id: tab.pageId,
                  title: 'Guide',
                  type: 'markdown',
                  folderId: null,
                  sortOrder: 0,
                  icon: 'BookOpen',
                  iconColor: 'slate',
                  updatedAt: ''
                }
              : isDeskPageId(tab.pageId)
                ? {
                    id: tab.pageId,
                    title: 'Desk',
                    type: 'markdown',
                    folderId: null,
                    sortOrder: 0,
                    icon: 'House',
                    iconColor: tree?.space.iconColor ?? 'slate',
                    updatedAt: ''
                  }
                : undefined)
        const active = page?.id === tab.pageId
        return (
          <button
            key={tab.pageId}
            type="button"
            className={cn(
              'app-no-drag group flex h-7 max-w-[200px] items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors duration-150',
              active
                ? 'bg-paper text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-paper/80 hover:text-foreground'
            )}
            onClick={() => void selectPage(tab.pageId, tab.spaceId)}
          >
            {runningPageIds.includes(tab.pageId) ? (
              <span
                className={cn(
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-md',
                  summary ? `icon-chip icon-chip-${summary.iconColor}` : 'icon-chip icon-chip-slate'
                )}
              >
                <Spinner className="size-3" />
              </span>
            ) : summary ? (
              <IconBadge icon={summary.icon} color={summary.iconColor} className="size-5" />
            ) : null}
            <span className="truncate">{displayTitle(summary?.title ?? 'Untitled')}</span>
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              {summary && !isDeskPageId(tab.pageId) ? (
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
          </button>
        )
      })}
    </div>
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
