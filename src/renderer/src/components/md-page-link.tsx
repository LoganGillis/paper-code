import { useMemo, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { PagePickList } from '@/components/page-picker'
import { filterPageHits } from '@/lib/pages'
import { TypeBadge } from '@/components/type-badge'
import { Input } from '@/components/ui/input'
import { findPageHit } from '@/lib/pages'
import { wantsNewTab } from '@/lib/platform'
import { useWorkspace } from '@/lib/workspace'

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
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
    return [{ tag: 'span[data-type="pageLink"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'pageLink' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView)
  }
})

function PageLinkView({ node, updateAttributes, editor }: ReactNodeViewProps): React.JSX.Element {
  const { trees, selectPage } = useWorkspace()
  const canEdit = editor.isEditable
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(canEdit && !node.attrs.pageId)
  const pageId = String(node.attrs.pageId || '')
  const hit = findPageHit(trees, pageId)
  const items = useMemo(() => filterPageHits(trees, query), [query, trees])

  if (!hit) {
    return (
      <NodeViewWrapper as="span" className="relative inline-block align-middle">
        <span
          className="inline-flex items-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-[13px] text-muted-foreground"
          contentEditable={false}
        >
          {canEdit && open ? (
            <span className="paper-float absolute top-full left-0 z-30 mt-1 w-72 p-1">
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages…"
                className="mb-1"
              />
              <PagePickList
                items={items}
                index={0}
                onPick={(item) => {
                  updateAttributes({ pageId: item.page.id })
                  setOpen(false)
                }}
              />
            </span>
          ) : canEdit ? (
            <button type="button" onClick={() => setOpen(true)}>
              Missing page
            </button>
          ) : (
            <span>Missing page</span>
          )}
        </span>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper as="span" className="inline-block align-middle">
      <button
        type="button"
        contentEditable={false}
        className="paper-page-link inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] align-middle"
        onClick={(event) =>
          void selectPage(hit.page.id, hit.spaceId, { newTab: wantsNewTab(event) })
        }
      >
        <IconBadge icon={hit.page.icon} color={hit.page.iconColor} className="size-4" />
        <span className="max-w-[12rem] truncate">{displayTitle(hit.page.title)}</span>
        <TypeBadge type={hit.page.type} />
      </button>
    </NodeViewWrapper>
  )
}
