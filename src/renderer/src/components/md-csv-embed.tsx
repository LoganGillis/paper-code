import { useEffect, useMemo, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { parseCsv } from '@shared/csv'
import type { Page } from '@shared/api'
import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { PagePickList } from '@/components/page-picker'
import { filterPageHits } from '@/lib/pages'
import { TypeBadge } from '@/components/type-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/rpc'
import { findPageHit } from '@/lib/pages'
import { useWorkspace } from '@/lib/workspace'

const PREVIEW_ROWS = 6

export const CsvEmbed = Node.create({
  name: 'csvEmbed',
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
      }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="csvEmbed"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'csvEmbed' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CsvEmbedView)
  }
})

function CsvEmbedView({ node, updateAttributes, editor }: ReactNodeViewProps): React.JSX.Element {
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

  const preview = useMemo(() => {
    if (!full || full.type !== 'csv') return null
    const rows = parseCsv(full.content)
    if (rows.length === 0) return { header: [], body: [], extra: 0 }
    const [header, ...body] = rows
    return {
      header,
      body: body.slice(0, PREVIEW_ROWS),
      extra: Math.max(0, body.length - PREVIEW_ROWS)
    }
  }, [full])

  return (
    <NodeViewWrapper className="paper-csv-embed my-4 overflow-hidden rounded-lg border border-border/70">
      {!hit || hit.page.type !== 'csv' ? (
        <div className="p-2" contentEditable={false}>
          {canEdit ? (
            <>
              <p className="px-2 pt-1 pb-2 text-sm text-muted-foreground">
                Choose a CSV to preview.
              </p>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tables…"
                className="mb-1"
              />
              <PagePickList
                items={items}
                index={0}
                onPick={(item) => updateAttributes({ pageId: item.page.id })}
              />
            </>
          ) : (
            <p className="px-2 py-2 text-sm text-muted-foreground">CSV preview unavailable.</p>
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
              onClick={() => void selectPage(hit.page.id, hit.spaceId)}
            >
              Open
            </Button>
          </div>
          {!full ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Open the table once to load a preview.
            </p>
          ) : preview && preview.header.length > 0 ? (
            <div className="max-h-56 overflow-auto">
              <table className="w-max min-w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    {preview.header.map((cell, index) => (
                      <th
                        key={index}
                        className="border-b border-r border-border/50 bg-sidebar px-2 py-1 text-left font-medium whitespace-nowrap"
                      >
                        {cell || `Column ${index + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.body.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border-b border-r border-border/40 px-2 py-1 whitespace-nowrap"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.extra > 0 ? (
                <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
                  {preview.extra} more rows in the full table
                </p>
              ) : null}
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">This CSV is empty.</p>
          )}
        </div>
      )}
    </NodeViewWrapper>
  )
}
