import { useCallback, useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import {
  CaseSensitive,
  ChartColumn,
  ChevronDown,
  ChevronUp,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Link2,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mark, mergeAttributes } from '@tiptap/core'
import { ChartEmbed } from '@/components/md-chart-embed'
import { CsvEmbed } from '@/components/md-csv-embed'
import { PageLink } from '@/components/md-page-link'
import { RunnableCode } from '@/components/md-run-block'
import { ScriptRun } from '@/components/md-script-run'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { PagePickList } from '@/components/page-picker'
import { filterPageHits } from '@/lib/pages'
import { setRunContext } from '@/lib/run-context'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { api } from '@/lib/rpc'

type SlashItem = {
  title: string
  hint?: string
  group: string
  aliases: string[]
  icon?: React.ReactNode
  run: (editor: Editor) => void
}

const TEXT_COLORS = [
  { label: 'Ink', value: '' },
  { label: 'Rose', value: 'oklch(0.48 0.1 12)' },
  { label: 'Amber', value: 'oklch(0.5 0.08 75)' },
  { label: 'Sage', value: 'oklch(0.42 0.06 140)' },
  { label: 'Sky', value: 'oklch(0.42 0.07 230)' },
  { label: 'Lilac', value: 'oklch(0.45 0.08 310)' }
]

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Rose', value: 'oklch(0.93 0.035 12)' },
  { label: 'Amber', value: 'oklch(0.95 0.045 90)' },
  { label: 'Sage', value: 'oklch(0.94 0.03 140)' },
  { label: 'Sky', value: 'oklch(0.94 0.03 230)' },
  { label: 'Lilac', value: 'oklch(0.94 0.03 310)' }
]

const TextColor = Mark.create({
  name: 'textColor',
  addAttributes() {
    return {
      color: { default: null }
    }
  },
  parseHTML() {
    return [
      {
        style: 'color',
        getAttrs: (value) => (typeof value === 'string' && value ? { color: value } : false)
      }
    ]
  },
  renderHTML({ HTMLAttributes }) {
    if (!HTMLAttributes.color) return ['span', 0]
    return ['span', mergeAttributes({ style: `color: ${HTMLAttributes.color}` }), 0]
  }
})

const UnderlineMark = Mark.create({
  name: 'underline',
  parseHTML() {
    return [{ tag: 'u' }, { style: 'text-decoration', getAttrs: (value) => value === 'underline' && null }]
  },
  renderHTML() {
    return ['u', 0]
  }
})

const HighlightColor = Mark.create({
  name: 'highlightColor',
  addAttributes() {
    return {
      color: { default: null }
    }
  },
  parseHTML() {
    return [
      {
        style: 'background-color',
        getAttrs: (value) => (typeof value === 'string' && value ? { color: value } : false)
      }
    ]
  },
  renderHTML({ HTMLAttributes }) {
    if (!HTMLAttributes.color) return ['span', 0]
    return ['span', mergeAttributes({ style: `background-color: ${HTMLAttributes.color}` }), 0]
  }
})

const slashItems: SlashItem[] = [
  {
    title: 'Text',
    group: 'Text',
    aliases: ['text', 'p'],
    run: (editor) => editor.chain().focus().setParagraph().run()
  },
  {
    title: 'Heading 1',
    group: 'Text',
    aliases: ['h1', 'heading'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    title: 'Heading 2',
    group: 'Text',
    aliases: ['h2'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    title: 'Heading 3',
    group: 'Text',
    aliases: ['h3'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    title: 'Bullet list',
    group: 'Text',
    aliases: ['ul', 'list', 'bullet'],
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    title: 'Numbered list',
    group: 'Text',
    aliases: ['ol', 'number'],
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    title: 'Quote',
    group: 'Text',
    aliases: ['quote', 'blockquote'],
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    title: 'Divider',
    group: 'Text',
    aliases: ['hr', 'div', 'divider'],
    run: (editor) => editor.chain().focus().setHorizontalRule().run()
  },
  {
    title: 'Runnable script',
    group: 'Paper',
    aliases: ['run', 'js', 'ts', 'inline'],
    icon: <FileCode2 className="size-3.5" />,
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertContent({ type: 'runnableCode', attrs: { language: 'javascript' } })
        .run()
  },
  {
    title: 'Run a page',
    group: 'Paper',
    aliases: ['play', 'remote', 'script'],
    icon: <FileCode2 className="size-3.5" />,
    run: (editor) => editor.chain().focus().insertContent({ type: 'scriptRun' }).run()
  },
  {
    title: 'Plain code',
    group: 'Paper',
    aliases: ['pre', 'fence', 'code'],
    run: (editor) => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    title: 'CSV preview',
    group: 'Paper',
    aliases: ['csv', 'table', 'data'],
    icon: <FileSpreadsheet className="size-3.5" />,
    run: (editor) => editor.chain().focus().insertContent({ type: 'csvEmbed' }).run()
  },
  {
    title: 'Chart',
    group: 'Paper',
    aliases: ['chart', 'graph', 'plot', 'viz'],
    icon: <ChartColumn className="size-3.5" />,
    run: (editor) => editor.chain().focus().insertContent({ type: 'chartEmbed' }).run()
  },
  {
    title: 'Page link',
    group: 'Paper',
    aliases: ['link', 'page', 'ref'],
    icon: <Link2 className="size-3.5" />,
    run: (editor) => editor.chain().focus().insertContent({ type: 'pageLink' }).run()
  }
]

function parseDoc(content: string): object {
  try {
    const parsed = JSON.parse(content) as unknown
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // Treat leftover plain text as a paragraph.
  }
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: content ? [{ type: 'text', text: content }] : [] }]
  }
}

function slashQuery(editor: Editor): { query: string; from: number; to: number } | null {
  const { $from } = editor.state.selection
  if ($from.parent.type.name !== 'paragraph') return null
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  const match = text.match(/(?:^|\s)\/([a-z0-9]*)$/i)
  if (!match) return null
  const to = $from.pos
  const from = to - match[0].trimStart().length
  return { query: match[1] ?? '', from, to }
}

function wikiQuery(editor: Editor): { query: string; from: number; to: number } | null {
  const { $from } = editor.state.selection
  if ($from.parent.type.name !== 'paragraph') return null
  const text = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
  const match = text.match(/\[\[([^\]]*)$/)
  if (!match) return null
  const to = $from.pos
  const from = to - match[0].length
  return { query: match[1] ?? '', from, to }
}

export function MarkdownEditor({
  content,
  onChange,
  placeholder = 'Write, or type / for commands',
  compact = false,
  restoreFocus = false,
  pageId,
  spaceId,
  readOnly = false,
  active = true,
  spellcheck = true
}: {
  content: string
  onChange: (value: string) => void
  placeholder?: string
  compact?: boolean
  restoreFocus?: boolean
  pageId?: string
  spaceId?: string
  readOnly?: boolean
  active?: boolean
  spellcheck?: boolean
}): React.JSX.Element {
  const { trees } = useWorkspace()
  const [spell, setSpell] = useState<{ misspelledWord: string; suggestions: string[] }>({
    misspelledWord: '',
    suggestions: []
  })

  useEffect(() => {
    return window.api?.onSpellContext?.((payload) => setSpell(payload))
  }, [])
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findIndex, setFindIndex] = useState(0)
  const [matchCase, setMatchCase] = useState(false)
  const [menu, setMenu] = useState<{
    query: string
    from: number
    to: number
    index: number
    top: number
    left: number
    kind: 'slash' | 'wiki'
  } | null>(null)

  const editor = useEditor({
    extensions: compact
      ? [
          StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
          Typography,
          Placeholder.configure({ placeholder })
        ]
      : [
          StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
          Typography,
          Placeholder.configure({ placeholder }),
          RunnableCode,
          CsvEmbed,
          ChartEmbed,
          PageLink,
          ScriptRun,
          TextColor,
          HighlightColor,
          UnderlineMark
        ],
    content: parseDoc(content),
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: compact ? 'tiptap tiptap-compact px-0.5' : 'tiptap min-h-[50vh] px-1'
      }
    },
    onUpdate: ({ editor: instance }) => {
      if (readOnly) return
      onChange(JSON.stringify(instance.getJSON()))
      const slash = slashQuery(instance)
      const wiki = compact ? null : wikiQuery(instance)
      const next = slash
        ? { ...slash, kind: 'slash' as const }
        : wiki
          ? { ...wiki, kind: 'wiki' as const }
          : null
      if (!next) {
        setMenu(null)
        return
      }
      const coords = instance.view.coordsAtPos(next.to)
      const parent = instance.view.dom.getBoundingClientRect()
      setMenu({
        ...next,
        index: 0,
        top: coords.bottom - parent.top + 6,
        left: coords.left - parent.left
      })
    }
  })

  useEffect(() => {
    if (!editor) return
    setRunContext(editor, pageId ?? '', spaceId ?? '')
  }, [editor, pageId, spaceId])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
    if (readOnly) setMenu(null)
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor) return
    if (JSON.stringify(editor.getJSON()) === content) return
    editor.commands.setContent(parseDoc(content), { emitUpdate: false })
  }, [content, editor])

  const slashMatches = useMemo(() => {
    if (!menu || menu.kind !== 'slash') return []
    const q = menu.query.toLowerCase()
    const items = compact
      ? slashItems.filter(
          (item) =>
            !item.aliases.some((alias) =>
              ['run', 'csv', 'chart', 'link', 'play', 'remote', 'script'].includes(alias)
            )
        )
      : slashItems
    return items.filter(
      (item) =>
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.aliases.some((alias) => alias.startsWith(q)) ||
        item.group.toLowerCase().startsWith(q)
    )
  }, [compact, menu])

  const wikiMatches = useMemo(() => {
    if (!menu || menu.kind !== 'wiki') return []
    return filterPageHits(trees, menu.query)
  }, [menu, trees])

  const applySlash = useCallback(
    (item: SlashItem): void => {
      if (!editor || !menu) return
      editor.chain().focus().deleteRange({ from: menu.from, to: menu.to }).run()
      item.run(editor)
      setMenu(null)
    },
    [editor, menu]
  )

  const applyWiki = useCallback(
    (pageIdToLink: string): void => {
      if (!editor || !menu) return
      editor
        .chain()
        .focus()
        .deleteRange({ from: menu.from, to: menu.to })
        .insertContent({ type: 'pageLink', attrs: { pageId: pageIdToLink } })
        .run()
      setMenu(null)
    },
    [editor, menu]
  )

  useEffect(() => {
    if (restoreFocus && editor) editor.commands.focus()
  }, [editor, restoreFocus])

  const doc = editor?.state.doc
  const findHits = useMemo(() => {
    if (!editor || !doc || !findQuery) return [] as Array<{ from: number; to: number }>
    const needle = matchCase ? findQuery : findQuery.toLowerCase()
    const hits: Array<{ from: number; to: number }> = []
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      const hay = matchCase ? node.text : node.text.toLowerCase()
      let start = 0
      while (start < hay.length) {
        const at = hay.indexOf(needle, start)
        if (at < 0) break
        hits.push({ from: pos + at, to: pos + at + findQuery.length })
        start = at + Math.max(1, needle.length)
      }
    })
    return hits
  }, [doc, editor, findQuery, matchCase])

  const selectHit = useCallback(
    (index: number) => {
      if (!editor || findHits.length === 0) return
      const next = ((index % findHits.length) + findHits.length) % findHits.length
      const hit = findHits[next]
      if (!hit) return
      setFindIndex(next)
      const selection = TextSelection.create(editor.state.doc, hit.from, hit.to)
      editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView())
    },
    [editor, findHits]
  )

  useEffect(() => {
    if (findOpen && findQuery) selectHit(0)
    // only jump when the query itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findQuery, matchCase, findOpen])

  useEffect(() => {
    if (!active || compact) return
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        event.stopPropagation()
        setFindOpen(true)
        return
      }
      if (event.key.toLowerCase() === 'd' && editor && !readOnly) {
        event.preventDefault()
        event.stopPropagation()
        const { $from } = editor.state.selection
        const node = $from.node(1)
        if (!node) return
        const pos = $from.after(1)
        editor.commands.insertContentAt(pos, node.toJSON())
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, compact, editor, readOnly])

  useEffect(() => {
    if (!editor) return
    const onKey = (event: KeyboardEvent): void => {
      if (!menu) return
      const count = menu.kind === 'slash' ? slashMatches.length : wikiMatches.length
      if (count === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMenu((current) =>
          current ? { ...current, index: (current.index + 1) % count } : current
        )
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMenu((current) =>
          current ? { ...current, index: (current.index - 1 + count) % count } : current
        )
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        if (menu.kind === 'slash') applySlash(slashMatches[menu.index] ?? slashMatches[0])
        else applyWiki((wikiMatches[menu.index] ?? wikiMatches[0]).page.id)
      }
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [applySlash, applyWiki, editor, menu, slashMatches, wikiMatches])

  return (
    <div className="relative">
      {findOpen && !compact ? (
        <div className="paper-float absolute top-0 right-0 z-20 flex items-center gap-1 p-2">
          <Input
            autoFocus
            value={findQuery}
            onChange={(event) => {
              setFindQuery(event.target.value)
              setFindIndex(0)
            }}
            placeholder="Find"
            className="h-8 w-44"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                selectHit(findIndex + (event.shiftKey ? -1 : 1))
              }
              if (event.key === 'Escape') setFindOpen(false)
            }}
          />
          <span className="font-mono text-[11px] text-muted-foreground">
            {findQuery ? `${findHits.length === 0 ? 0 : findIndex + 1}/${findHits.length}` : '0/0'}
          </span>
          <Button
            type="button"
            variant={matchCase ? 'secondary' : 'ghost'}
            size="icon"
            className="size-8"
            aria-label="Match case"
            onClick={() => setMatchCase((value) => !value)}
          >
            <CaseSensitive className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Previous"
            onClick={() => selectHit(findIndex - 1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Next"
            onClick={() => selectHit(findIndex + 1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Close find"
            onClick={() => setFindOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
      {compact ? (
        <div spellCheck={spellcheck}>
          <EditorContent editor={editor} />
        </div>
      ) : (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div spellCheck={spellcheck}>
            <EditorContent editor={editor} />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-auto min-w-0 p-1.5">
          {spell.suggestions.length > 0 || spell.misspelledWord ? (
            <>
              {spell.suggestions.map((word) => (
                <ContextMenuItem
                  key={word}
                  onSelect={() => {
                    document.execCommand('insertText', false, word)
                  }}
                >
                  {word}
                </ContextMenuItem>
              ))}
              {spell.misspelledWord ? (
                <ContextMenuItem
                  onSelect={() => void api.app.addToDictionary({ word: spell.misspelledWord })}
                >
                  Add to dictionary
                </ContextMenuItem>
              ) : null}
              <ContextMenuSeparator />
            </>
          ) : null}
          <div className="flex items-center gap-0.5">
            <ContextMenuItem
              disabled={readOnly}
              className={cn(
                'size-8 justify-center p-0 font-serif text-[15px] font-bold',
                editor?.isActive('bold') && 'bg-accent'
              )}
              onSelect={() => editor?.chain().focus().toggleBold().run()}
            >
              B
            </ContextMenuItem>
            <ContextMenuItem
              disabled={readOnly}
              className={cn(
                'size-8 justify-center p-0 font-serif text-[15px] italic',
                editor?.isActive('italic') && 'bg-accent'
              )}
              onSelect={() => editor?.chain().focus().toggleItalic().run()}
            >
              I
            </ContextMenuItem>
            <ContextMenuItem
              disabled={readOnly}
              className={cn(
                'size-8 justify-center p-0 font-serif text-[15px] underline decoration-[1.5px] underline-offset-2',
                editor?.isActive('underline') && 'bg-accent'
              )}
              onSelect={() => editor?.chain().focus().toggleMark('underline').run()}
            >
              U
            </ContextMenuItem>
            <ContextMenuItem
              disabled={readOnly}
              className={cn(
                'size-8 justify-center p-0 font-serif text-[15px] line-through',
                editor?.isActive('strike') && 'bg-accent'
              )}
              onSelect={() => editor?.chain().focus().toggleStrike().run()}
            >
              S
            </ContextMenuItem>
            <ContextMenuItem
              disabled={readOnly}
              className={cn(
                'size-8 justify-center p-0 font-mono text-[13px]',
                editor?.isActive('code') && 'bg-accent'
              )}
              onSelect={() => editor?.chain().focus().toggleCode().run()}
            >
              {'</>'}
            </ContextMenuItem>
          </div>
          <div className="mt-1 flex items-center justify-between">
            {TEXT_COLORS.map((item) => (
              <ContextMenuItem
                key={`fg-${item.label}`}
                disabled={readOnly}
                title={item.label}
                className="size-6 justify-center rounded-md p-0"
                onSelect={() => {
                  if (!editor) return
                  if (!item.value) editor.chain().focus().unsetMark('textColor').run()
                  else editor.chain().focus().setMark('textColor', { color: item.value }).run()
                }}
              >
                <span
                  className="flex size-4 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    color: item.value || 'var(--foreground)',
                    boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--foreground) 18%, transparent)'
                  }}
                >
                  A
                </span>
              </ContextMenuItem>
            ))}
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            {HIGHLIGHT_COLORS.map((item) => (
              <ContextMenuItem
                key={`bg-${item.label}`}
                disabled={readOnly}
                title={item.label}
                className="size-6 justify-center rounded-md p-0"
                onSelect={() => {
                  if (!editor) return
                  if (!item.value) editor.chain().focus().unsetMark('highlightColor').run()
                  else editor.chain().focus().setMark('highlightColor', { color: item.value }).run()
                }}
              >
                <span
                  className="size-4 rounded-sm"
                  style={{
                    background: item.value || 'transparent',
                    boxShadow: 'inset 0 0 0 1px color-mix(in oklab, var(--foreground) 18%, transparent)'
                  }}
                />
              </ContextMenuItem>
            ))}
          </div>
          <ContextMenuSeparator className="-mx-1.5 my-1.5" />
          <div className="flex items-center">
            <ContextMenuItem
              className="h-7 flex-1 justify-center px-0"
              onSelect={() => document.execCommand('copy')}
            >
              Copy
            </ContextMenuItem>
            <ContextMenuItem
              className="h-7 flex-1 justify-center px-0"
              disabled={readOnly}
              onSelect={() => document.execCommand('cut')}
            >
              Cut
            </ContextMenuItem>
            <ContextMenuItem
              className="h-7 flex-1 justify-center px-0"
              disabled={readOnly}
              onSelect={() => document.execCommand('paste')}
            >
              Paste
            </ContextMenuItem>
          </div>
        </ContextMenuContent>
      </ContextMenu>
      )}
      {!readOnly && menu && menu.kind === 'slash' && slashMatches.length > 0 ? (
        <div
          className="absolute z-20 max-h-64 w-56 overflow-y-auto rounded-lg border bg-popover py-1 shadow-md"
          style={{ top: menu.top, left: menu.left }}
          onWheel={(event) => event.stopPropagation()}
        >
          {slashMatches.map((item, index) => {
            const prev = slashMatches[index - 1]
            return (
              <div key={item.title}>
                {item.group !== prev?.group ? (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {item.group}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm',
                    index === menu.index ? 'bg-accent' : 'hover:bg-accent/70'
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    applySlash(item)
                  }}
                >
                  <span className="text-muted-foreground">
                    {item.icon ?? <FileText className="size-3.5" />}
                  </span>
                  {item.title}
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
      {!readOnly && menu && menu.kind === 'wiki' ? (
        <div
          className="absolute z-20 w-80 overflow-hidden rounded-lg border bg-popover shadow-md"
          style={{ top: menu.top, left: menu.left }}
        >
          <PagePickList
            items={wikiMatches}
            index={menu.index}
            onPick={(item) => applyWiki(item.page.id)}
          />
        </div>
      ) : null}
    </div>
  )
}
