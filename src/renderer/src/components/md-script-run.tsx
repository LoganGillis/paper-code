import { useCallback, useMemo, useState } from 'react'
import { PanelBottom, SquareArrowOutUpRight } from 'lucide-react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'

import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { PagePickList } from '@/components/page-picker'
import { RunOutput } from '@/components/run-output'
import { TypeBadge } from '@/components/type-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/rpc'
import { filterPageHits, findPageHit } from '@/lib/pages'
import { getRunContext } from '@/lib/run-context'
import { useWorkspace } from '@/lib/workspace'
import { usePopoutOutput } from '@/lib/output-popout'
import { RunButton } from '@/components/run-button'
import { runSourceFor } from '@/lib/run-drafts'
import { useRunPage } from '@/lib/run-page'

export const ScriptRun = Node.create({
  name: 'scriptRun',
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
    return [{ tag: 'div[data-type="scriptRun"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'scriptRun' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ScriptRunView)
  }
})

function ScriptRunView({ node, updateAttributes, editor }: ReactNodeViewProps): React.JSX.Element {
  const { trees, pagesById } = useWorkspace()
  const canEdit = editor.isEditable
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState(false)
  const pageId = String(node.attrs.pageId || '')
  const hit = findPageHit(trees, pageId)
  const script = hit?.page.type === 'javascript' || hit?.page.type === 'typescript' ? hit : null
  const items = useMemo(
    () => filterPageHits(trees, query, ['javascript', 'typescript']),
    [query, trees]
  )
  const host = getRunContext(editor)
  const accent = pagesById[host.pageId]?.iconColor ?? script?.page.iconColor ?? 'slate'
  const { run, running, clear, execute } = useRunPage({ tabId: pageId, shared: true })

  const output = usePopoutOutput(
    {
      key: `script-run:${host.pageId}:${pageId || 'none'}`,
      title: script ? displayTitle(script.page.title) : 'Script',
      accent,
      run,
      running
    },
    clear
  )

  const onRun = useCallback(async () => {
    if (!script) return
    await execute(async () => {
      const full = pagesById[script.page.id] ?? (await api.pages.get({ id: script.page.id }))
      return {
        language: full.type === 'typescript' ? 'typescript' : 'javascript',
        source: runSourceFor(full.id, full.content),
        spaceId: full.spaceId,
        pageId: full.id
      }
    })
  }, [execute, pagesById, script])

  return (
    <NodeViewWrapper className="paper-script-run my-4 overflow-hidden rounded-lg border border-border/70">
      <div className="flex items-center gap-2 p-2" contentEditable={false}>
        {script ? (
          <>
            <IconBadge icon={script.page.icon} color={script.page.iconColor} className="size-6" />
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-[13px]"
              onClick={() => canEdit && setPicking((value) => !value)}
            >
              {displayTitle(script.page.title)}
            </button>
            <TypeBadge type={script.page.type} />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground [&_svg]:size-3.5"
              aria-label={output.popped ? 'Show output window' : 'Pop out output'}
              onClick={() => (output.popped ? output.show() : output.pop())}
            >
              <SquareArrowOutUpRight />
            </Button>
            <RunButton accent={accent} running={running} onRun={() => void onRun()} />
          </>
        ) : (
          <p className="px-1 text-sm text-muted-foreground">Choose a script to run.</p>
        )}
      </div>
      {(picking || !script) && canEdit ? (
        <div className="border-t border-border/60 p-2" contentEditable={false}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a script"
            className="mb-2 h-8"
          />
          <PagePickList
            items={items}
            index={0}
            onPick={(item) => {
              updateAttributes({ pageId: item.page.id })
              setPicking(false)
              setQuery('')
            }}
          />
        </div>
      ) : null}
      {output.popped ? (
        <div
          className="flex items-center justify-between gap-3 border-t border-border/60 bg-sidebar/50 px-3 py-2"
          contentEditable={false}
        >
          <p className="text-[12px] text-muted-foreground">Output is in its own window.</p>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground [&_svg]:size-3.5"
              aria-label="Show output window"
              onClick={output.show}
            >
              <SquareArrowOutUpRight />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-6 text-muted-foreground [&_svg]:size-3.5"
              aria-label="Dock output"
              onClick={output.dock}
            >
              <PanelBottom />
            </Button>
          </div>
        </div>
      ) : run ? (
        <div className="border-t border-border/60 bg-sidebar/50" contentEditable={false}>
          <RunOutput run={run} />
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
