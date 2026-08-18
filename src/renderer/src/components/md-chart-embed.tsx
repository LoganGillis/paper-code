import { useEffect, useMemo, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import type { Page } from '@shared/api'
import { parseCsv } from '@shared/csv'
import { displayTitle } from '@shared/titles'
import { CsvChart } from '@/components/csv-chart'
import { IconBadge } from '@/components/icon-picker'
import { PagePickList } from '@/components/page-picker'
import { TypeBadge } from '@/components/type-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { defaultChartSpec, inspectColumns, type ChartKind, type ChartSpec } from '@/lib/chart-data'
import { api } from '@/lib/rpc'
import { filterPageHits, findPageHit } from '@/lib/pages'
import { wantsNewTab } from '@/lib/platform'
import { useWorkspace } from '@/lib/workspace'

export const ChartEmbed = Node.create({
  name: 'chartEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-page-id') || '',
        renderHTML: (attributes) => ({ 'data-page-id': attributes.pageId })
      },
      kind: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-kind') || '',
        renderHTML: (attributes) => ({ 'data-kind': attributes.kind })
      },
      x: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-x') || '',
        renderHTML: (attributes) => ({ 'data-x': attributes.x })
      },
      y: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-y') || '',
        renderHTML: (attributes) => ({ 'data-y': attributes.y })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="chartEmbed"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'chartEmbed' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartEmbedView)
  }
})

function ChartEmbedView({ node, updateAttributes, editor }: ReactNodeViewProps): React.JSX.Element {
  const { trees, pagesById, selectPage } = useWorkspace()
  const canEdit = editor.isEditable
  const [query, setQuery] = useState('')
  const pageId = String(node.attrs.pageId || '')
  const hit = findPageHit(trees, pageId)
  const cached = pagesById[pageId]
  const [loaded, setLoaded] = useState<Page | null>(cached ?? null)
  const full = cached ?? loaded
  const items = useMemo(() => filterPageHits(trees, query, ['csv']), [query, trees])

  useEffect(() => {
    if (!pageId || cached) return
    void api.pages
      .get({ id: pageId })
      .then(setLoaded)
      .catch(() => setLoaded(null))
  }, [cached, pageId])

  useEffect(() => {
    if (!full || full.type !== 'csv') return
    const inferred = defaultChartSpec(inspectColumns(parseCsv(full.content)))
    const next = {
      kind: (node.attrs.kind as ChartKind) || inferred.kind,
      x: String(node.attrs.x || inferred.x),
      y: String(node.attrs.y || inferred.y)
    }
    if (next.kind === node.attrs.kind && next.x === node.attrs.x && next.y === node.attrs.y) return
    if (!next.x && !next.y) return
    updateAttributes(next)
  }, [full, node.attrs.kind, node.attrs.x, node.attrs.y, updateAttributes])

  const spec: ChartSpec = {
    kind: (node.attrs.kind as ChartKind) || 'bar',
    x: String(node.attrs.x || ''),
    y: String(node.attrs.y || '')
  }

  return (
    <NodeViewWrapper className="paper-chart-embed my-4 overflow-hidden rounded-lg border border-border/70">
      {!hit || hit.page.type !== 'csv' ? (
        <div className="p-2" contentEditable={false}>
          {canEdit ? (
            <>
              <p className="px-2 pt-1 pb-2 text-sm text-muted-foreground">Choose a CSV to chart.</p>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tables…"
                className="mb-1"
              />
              <PagePickList
                items={items}
                index={0}
                onPick={(item) =>
                  updateAttributes({ pageId: item.page.id, kind: '', x: '', y: '' })
                }
              />
            </>
          ) : (
            <p className="px-2 py-2 text-sm text-muted-foreground">Chart unavailable.</p>
          )}
        </div>
      ) : (
        <div contentEditable={false}>
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <IconBadge icon={hit.page.icon} color={hit.page.iconColor} className="size-5" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {displayTitle(hit.page.title)}
            </span>
            <TypeBadge type="csv" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) =>
                void selectPage(hit.page.id, hit.spaceId, { newTab: wantsNewTab(event) })
              }
            >
              Open
            </Button>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => updateAttributes({ pageId: '', kind: '', x: '', y: '' })}
              >
                Change
              </Button>
            ) : null}
          </div>
          {!full ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Open the table once to load a chart.
            </p>
          ) : (
            <CsvChart
              content={full.content}
              spec={spec}
              accent={hit.page.iconColor}
              height={220}
              compact
              onSpecChange={
                canEdit
                  ? (next) => updateAttributes({ kind: next.kind, x: next.x, y: next.y })
                  : undefined
              }
            />
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}
