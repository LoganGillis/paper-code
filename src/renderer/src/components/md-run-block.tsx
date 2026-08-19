import { useCallback, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { Maximize2, Play } from 'lucide-react'
import type { RunResult } from '@shared/api'
import { CodeEditor } from '@/components/code-editor'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/rpc'
import { RUN_ACCENT } from '@/lib/run-accent'
import { newBlockId } from '@/lib/run-block'
import { getRunContext } from '@/lib/run-context'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { wantsNewTab } from '@/lib/platform'

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
      },
      blockId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id'),
        renderHTML: (attributes) =>
          attributes.blockId ? { 'data-block-id': attributes.blockId } : {}
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
  editor,
  getPos
}: ReactNodeViewProps): React.JSX.Element {
  const language = node.attrs.language === 'typescript' ? 'typescript' : 'javascript'
  const canEdit = editor.isEditable
  const [run, setRun] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const paper = getRunContext(editor)
  const pageId = paper.pageId
  const spaceId = paper.spaceId
  const { pagesById, openRunBlock } = useWorkspace()
  const accent = pagesById[pageId]?.iconColor ?? 'slate'
  const source = node.textContent

  const openFull = (newTab = false): void => {
    if (!pageId || !spaceId) return
    const blockId = String(node.attrs.blockId || '') || newBlockId()
    if (!node.attrs.blockId) updateAttributes({ blockId })
    openRunBlock({
      pageId,
      spaceId,
      blockId,
      language,
      source,
      newTab
    })
  }

  const writeSource = useCallback(
    (value: string) => {
      if (!canEdit || value === node.textContent) return
      const pos = getPos()
      if (typeof pos !== 'number') return
      editor.view.dispatch(editor.state.tr.insertText(value, pos + 1, pos + node.nodeSize - 1))
    },
    [canEdit, editor, getPos, node.nodeSize, node.textContent]
  )

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
        {canEdit ? (
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
                onClick={() => updateAttributes({ language: id })}
              >
                {id === 'javascript' ? 'JavaScript' : 'TypeScript'}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {pageId && spaceId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              aria-label="Open as page"
              onClick={(event) => openFull(wantsNewTab(event))}
            >
              <Maximize2 />
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className={cn('h-7 shadow-none', RUN_ACCENT[accent])}
            disabled={running || !source.trim()}
            onClick={() => void onRun()}
          >
            <Play />
            {running ? 'Running' : 'Run'}
          </Button>
        </div>
      </div>
      <div className="bg-sidebar/40" contentEditable={false}>
        <CodeEditor
          compact
          readOnly={!canEdit}
          active
          accent={accent}
          language={language}
          value={source}
          onChange={writeSource}
          onRun={() => void onRun()}
        />
      </div>
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
