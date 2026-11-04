import { useCallback, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import { Maximize2, PanelBottom, SquareArrowOutUpRight } from 'lucide-react'
import { CodeEditor } from '@/components/code-editor'
import { Button } from '@/components/ui/button'
import { newBlockId } from '@/lib/run-block'
import { getRunContext } from '@/lib/run-context'
import { useWorkspace } from '@/lib/workspace'
import { RunOutput } from '@/components/run-output'
import { wantsNewTab } from '@/lib/platform'
import { usePopoutOutput } from '@/lib/output-popout'
import { RunButton } from '@/components/run-button'
import { Segmented } from '@/components/editor-bar'
import { useRunPage } from '@/lib/run-page'

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
  const paper = getRunContext(editor)
  const pageId = paper.pageId
  const { run, running, clear, execute } = useRunPage({ tabId: pageId })
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

  const [blockId] = useState(() => String(node.attrs.blockId || '') || newBlockId())
  const output = usePopoutOutput(
    {
      key: `run-block:${pageId}:${blockId}`,
      title: 'Run block',
      accent,
      run,
      running
    },
    clear
  )

  const onRun = useCallback(async () => {
    if (!pageId || !spaceId) return
    await execute({ language, source: node.textContent, spaceId, pageId })
  }, [execute, language, node.textContent, pageId, spaceId])

  return (
    <NodeViewWrapper className="paper-run-block my-4 overflow-hidden rounded-lg border border-border/70">
      <div
        className="flex items-center gap-2 border-b border-border/60 p-2"
        contentEditable={false}
      >
        {canEdit ? (
          <Segmented
            label="Language"
            value={language}
            options={[
              { id: 'javascript', label: 'JavaScript' },
              { id: 'typescript', label: 'TypeScript' }
            ]}
            onChange={(id) => updateAttributes({ language: id })}
          />
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
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground [&_svg]:size-3.5"
            aria-label={output.popped ? 'Show output window' : 'Pop out output'}
            onClick={() => {
              if (node.attrs.blockId !== blockId) updateAttributes({ blockId })
              if (output.popped) output.show()
              else output.pop()
            }}
          >
            <SquareArrowOutUpRight />
          </Button>
          <RunButton
            accent={accent}
            running={running}
            disabled={!source.trim()}
            onRun={() => void onRun()}
          />
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
