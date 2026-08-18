import { useCallback, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { Play } from 'lucide-react'
import type { RunResult } from '@shared/api'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { api } from '@/lib/rpc'
import { RUN_ACCENT } from '@/lib/run-accent'
import { getRunContext } from '@/lib/run-context'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { modSymbol } from '@/lib/platform'

export const RunnableCode = Node.create({
  name: 'runnableCode',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,

  addStorage() {
    return {
      pageId: '',
      spaceId: ''
    }
  },

  addAttributes() {
    return {
      language: {
        default: 'javascript',
        parseHTML: (element) => element.getAttribute('data-language') || 'javascript',
        renderHTML: (attributes) => ({ 'data-language': attributes.language })
      }
    }
  },

  parseHTML() {
    return [{ tag: 'pre[data-type="runnableCode"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['pre', mergeAttributes(HTMLAttributes, { 'data-type': 'runnableCode' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(RunnableCodeView)
  }
})

function RunnableCodeView({
  node,
  updateAttributes,
  editor
}: ReactNodeViewProps): React.JSX.Element {
  const language = node.attrs.language === 'typescript' ? 'typescript' : 'javascript'
  const canEdit = editor.isEditable
  const [run, setRun] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const paper = getRunContext(editor)
  const pageId = paper.pageId
  const spaceId = paper.spaceId
  const { pagesById } = useWorkspace()
  const accent = pagesById[pageId]?.iconColor ?? 'slate'

  const onRun = useCallback(async () => {
    if (!pageId || !spaceId) return
    setRunning(true)
    try {
      setRun(
        await api.run.execute({
          language,
          source: node.textContent,
          spaceId,
          pageId
        })
      )
    } finally {
      setRunning(false)
    }
  }, [language, node.textContent, pageId, spaceId])

  return (
    <NodeViewWrapper className="paper-run-block my-4 overflow-hidden rounded-lg border border-border/70">
      <div
        className="flex items-center gap-2 border-b border-border/60 p-2"
        contentEditable={false}
      >
        <div className="flex rounded-md bg-sidebar p-0.5">
          {(['javascript', 'typescript'] as const).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                'h-6 px-2 text-[11px]',
                language === id && 'bg-paper text-foreground shadow-sm'
              )}
              disabled={!canEdit}
              onClick={() => {
                if (canEdit) updateAttributes({ language: id })
              }}
            >
              {id === 'javascript' ? 'JS' : 'TS'}
            </Button>
          ))}
        </div>
        <div className="ml-auto">
          <Button
            type="button"
            size="sm"
            className={cn('h-7 shadow-none', RUN_ACCENT[accent])}
            disabled={running || !node.textContent.trim()}
            onClick={() => void onRun()}
          >
            <Play />
            {running ? 'Running' : 'Run'}
            <KbdGroup className="ml-1 opacity-80">
              <Kbd className="bg-current/15 text-current">{modSymbol()}</Kbd>
              <Kbd className="bg-current/15 text-current">↵</Kbd>
            </KbdGroup>
          </Button>
        </div>
      </div>
      <pre
        className="m-0 bg-sidebar/40 px-3 py-2 font-mono text-[12.5px] leading-6"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            event.stopPropagation()
            void onRun()
          }
        }}
      >
        <NodeViewContent className="block whitespace-pre-wrap outline-none" />
      </pre>
      {run ? (
        <div
          className="select-text border-t border-border/60 bg-sidebar/50 px-3 py-2 font-mono text-[12.5px] leading-6"
          contentEditable={false}
        >
          {run.logs.map((line, index) => (
            <p
              key={`${line.level}-${index}`}
              className={cn(
                line.level === 'error' && 'text-destructive',
                line.level === 'warn' && 'text-amber-800 dark:text-amber-200'
              )}
            >
              {line.message}
            </p>
          ))}
          {run.result ? <p className="text-ink-soft">{run.result}</p> : null}
          {run.error ? <p className="text-destructive">{run.error}</p> : null}
        </div>
      ) : null}
    </NodeViewWrapper>
  )
}
