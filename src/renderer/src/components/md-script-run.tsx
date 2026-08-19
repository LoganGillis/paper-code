import { useCallback, useMemo, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { Play } from 'lucide-react'
import type { RunResult } from '@shared/api'
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
import { RUN_ACCENT } from '@/lib/run-accent'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'

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
  const { trees, pagesById, setPageRunning, runningPageIds } = useWorkspace()
  const canEdit = editor.isEditable
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState(false)
  const [run, setRun] = useState<RunResult | null>(null)
  const pageId = String(node.attrs.pageId || '')
  const hit = findPageHit(trees, pageId)
  const script = hit?.page.type === 'javascript' || hit?.page.type === 'typescript' ? hit : null
  const items = useMemo(
    () => filterPageHits(trees, query, ['javascript', 'typescript']),
    [query, trees]
  )
  const host = getRunContext(editor)
  const accent = pagesById[host.pageId]?.iconColor ?? script?.page.iconColor ?? 'slate'
  const running = Boolean(pageId && runningPageIds.includes(pageId))

  const onRun = useCallback(async () => {
    if (!script) return
    const full = pagesById[script.page.id] ?? (await api.pages.get({ id: script.page.id }))
    setPageRunning(full.id, true)
    try {
      setRun(
        await api.run.execute({
          language: full.type === 'typescript' ? 'typescript' : 'javascript',
          source: full.content,
          spaceId: full.spaceId,
          pageId: full.id
        })
      )
    } finally {
      setPageRunning(full.id, false)
    }
  }, [pagesById, script, setPageRunning])

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
              size="sm"
              className={cn('h-7 shadow-none', RUN_ACCENT[accent])}
              disabled={running}
              onClick={() => void onRun()}
            >
              <Play />
              {running ? 'Running' : 'Run'}
            </Button>
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
      {run ? (
        <div className="border-t border-border/60 bg-sidebar/50" contentEditable={false}>
          <RunOutput run={run} />
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
