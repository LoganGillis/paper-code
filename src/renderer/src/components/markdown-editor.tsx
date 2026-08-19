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
import { ChartEmbed } from '@/components/md-chart-embed'
import { CsvEmbed } from '@/components/md-csv-embed'
import { PageLink } from '@/components/md-page-link'
import { RunnableCode } from '@/components/md-run-block'
import { PagePickList } from '@/components/page-picker'
import { filterPageHits } from '@/lib/pages'
import { setRunContext } from '@/lib/run-context'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'

type SlashItem = {
  title: string
  hint: string
  aliases: string[]
  icon?: React.ReactNode
  run: (editor: Editor) => void
}

const slashItems: SlashItem[] = [
  {
    title: 'Text',
    hint: 'Plain paragraph',
    aliases: ['text', 'p'],
    run: (editor) => editor.chain().focus().setParagraph().run()
  },
  {
    title: 'Heading 1',
    hint: 'Large title',
    aliases: ['h1', 'heading'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run()
  },
  {
    title: 'Heading 2',
    hint: 'Section heading',
    aliases: ['h2'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
  },
  {
    title: 'Heading 3',
    hint: 'Subheading',
    aliases: ['h3'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
  },
  {
    title: 'Bullet list',
    hint: 'Unordered list',
    aliases: ['ul', 'list', 'bullet'],
    run: (editor) => editor.chain().focus().toggleBulletList().run()
  },
  {
    title: 'Numbered list',
    hint: 'Ordered list',
    aliases: ['ol', 'number'],
    run: (editor) => editor.chain().focus().toggleOrderedList().run()
  },
  {
    title: 'Quote',
    hint: 'Callout block',
    aliases: ['quote', 'blockquote'],
    run: (editor) => editor.chain().focus().toggleBlockquote().run()
  },
  {
    title: 'Divider',
    hint: 'Horizontal rule',
    aliases: ['hr', 'div', 'divider'],
    run: (editor) => editor.chain().focus().setHorizontalRule().run()
  },
  {
    title: 'Runnable script',
    hint: 'JS or TS you can run here',
    aliases: ['run', 'js', 'ts', 'script', 'code'],
    icon: <FileCode2 className="size-3.5" />,
    run: (editor) =>
      editor
        .chain()
        .focus()
        .insertContent({ type: 'runnableCode', attrs: { language: 'javascript' } })
        .run()
  },
  {
    title: 'Plain code',
    hint: 'Fenced, not runnable',
    aliases: ['pre', 'fence'],
    run: (editor) => editor.chain().focus().toggleCodeBlock().run()
  },
  {
    title: 'CSV preview',
    hint: 'Show a table from this space',
    aliases: ['csv', 'table', 'data'],
    icon: <FileSpreadsheet className="size-3.5" />,
    run: (editor) => editor.chain().focus().insertContent({ type: 'csvEmbed' }).run()
  },
  {
    title: 'Chart',
    hint: 'Graph a CSV from this space',
    aliases: ['chart', 'graph', 'plot', 'viz'],
    icon: <ChartColumn className="size-3.5" />,
    run: (editor) => editor.chain().focus().insertContent({ type: 'chartEmbed' }).run()
  },
  {
    title: 'Page link',
    hint: 'Link to a page, script, or table',
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
  active = true
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
}): React.JSX.Element {
  const { trees } = useWorkspace()
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
          PageLink
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
          (item) => !item.aliases.some((alias) => ['run', 'csv', 'chart', 'link'].includes(alias))
        )
      : slashItems
    return items.filter(
      (item) =>
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.aliases.some((alias) => alias.startsWith(q))
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
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, compact])

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
      <EditorContent editor={editor} />
      {!readOnly && menu && menu.kind === 'slash' && slashMatches.length > 0 ? (
        <div
          className="absolute z-20 w-64 overflow-hidden rounded-lg border bg-popover py-1 shadow-md"
          style={{ top: menu.top, left: menu.left }}
        >
          {slashMatches.map((item, index) => (
            <button
              key={item.title}
              type="button"
              className={cn(
                'flex w-full items-start gap-2 px-3 py-1.5 text-left',
                index === menu.index ? 'bg-accent' : 'hover:bg-accent/70'
              )}
              onMouseDown={(event) => {
                event.preventDefault()
                applySlash(item)
              }}
            >
              <span className="mt-0.5 text-muted-foreground">
                {item.icon ?? <FileText className="size-3.5" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.hint}</span>
              </span>
            </button>
          ))}
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
