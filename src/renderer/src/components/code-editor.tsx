import { useEffect, useMemo, useRef, useState } from 'react'
import { transform } from 'sucrase'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { definitionAt, importSpecAt, renameAt } from '@shared/js-refs'
import { jsonErrorAt } from '@shared/json-text'
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint'
import { createPaperAutocomplete } from '@/lib/paper-completions'
import { useWorkspace } from '@/lib/workspace'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { search } from '@codemirror/search'
import { tags } from '@lezer/highlight'
import type { IconColorId } from '@shared/icons'
import { ICON_ACCENT } from '@shared/icons'
import { FindBar } from '@/components/find-bar'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

function mix(accent: string, into: string, amount: number): string {
  return `color-mix(in oklab, ${accent} ${amount}%, ${into})`
}

function paperHighlight(dark: boolean, accent: string): HighlightStyle {
  const ink = dark ? '#ece4d6' : '#32281f'
  const keyword = dark ? mix(accent, ink, 42) : accent
  const fn = dark ? mix(accent, '#c9b08b', 32) : mix(accent, '#5c4630', 55)
  return HighlightStyle.define([
    { tag: tags.comment, color: dark ? '#9a8f7c' : '#8a7d6b', fontStyle: 'italic' },
    { tag: tags.keyword, color: keyword },
    { tag: tags.string, color: dark ? '#b7c99a' : '#4d6b3c' },
    { tag: tags.number, color: dark ? '#d7b46a' : '#8a5a18' },
    { tag: tags.function(tags.variableName), color: fn },
    { tag: tags.typeName, color: dark ? '#c4a882' : '#6b5340' },
    { tag: tags.bool, color: keyword },
    { tag: tags.operator, color: dark ? '#c4b8a8' : '#5c5248' },
    { tag: tags.definition(tags.variableName), color: dark ? '#e6dcc8' : '#3a2f26' }
  ])
}

const runHandlers = new WeakMap<EditorView, () => void>()

const runKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Mod-Enter',
      preventDefault: true,
      stopPropagation: true,
      run: (view) => {
        runHandlers.get(view)?.()
        return true
      }
    }
  ])
)

function paperTheme(dark: boolean, accent: string): ReturnType<typeof EditorView.theme> {
  const ink = dark ? '#ece4d6' : '#32281f'
  const selection = mix(accent, 'transparent', dark ? 32 : 26)
  const caret = dark ? mix(accent, ink, 50) : accent
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        color: ink,
        fontSize: '12.5px'
      },
      '.cm-scroller': {
        overflow: 'auto'
      },
      '.cm-content': {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        caretColor: caret,
        padding: '4px 0 32px 6px'
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        border: 'none',
        color: dark ? '#8a8174' : '#a39888',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        paddingRight: '10px'
      },
      '.cm-lineNumbers .cm-gutterElement': {
        paddingRight: '4px'
      },
      '.cm-activeLine': {
        backgroundColor: mix(accent, 'transparent', dark ? 10 : 7)
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: caret
      },
      '.cm-selectionBackground': {
        backgroundColor: selection
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
        backgroundColor: selection
      },
      '.cm-content ::selection': {
        backgroundColor: selection
      },
      '.cm-cursor': {
        borderLeftColor: caret
      },
      '.cm-searchMatch': {
        backgroundColor: mix(accent, 'transparent', dark ? 28 : 22)
      },
      '.cm-searchMatch-selected': {
        backgroundColor: mix(accent, 'transparent', dark ? 44 : 34)
      },
      '.cm-tooltip-autocomplete': {
        borderRadius: '4px'
      }
    },
    { dark }
  )
}

const jsonLint = [
  linter(
    (view): Diagnostic[] => {
      const text = view.state.doc.toString()
      const at = jsonErrorAt(text)
      if (!at) return []
      const from = Math.min(at.offset, text.length)
      return [
        {
          from,
          to: Math.min(from + 1, text.length),
          severity: 'error',
          message: at.message
        }
      ]
    },
    { delay: 300 }
  ),
  lintGutter()
]

export function CodeEditor({
  value,
  language,
  onChange,
  active = true,
  accent = 'slate',
  onRun,
  restoreFocus = false,
  compact = false,
  readOnly = false,
  onFormat,
  onEditorView
}: {
  value: string
  language: 'javascript' | 'typescript' | 'json'
  onChange: (value: string) => void
  active?: boolean
  accent?: IconColorId
  onRun?: () => void
  restoreFocus?: boolean
  compact?: boolean
  readOnly?: boolean
  /** Shown as Format in the JSON context menu. */
  onFormat?: () => void
  onEditorView?: (view: EditorView | null) => void
}): React.JSX.Element {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const { trees, selectPage } = useWorkspace()
  const pageTitles = useMemo(() => {
    const csv: string[] = []
    const jsonTitles: string[] = []
    const walk = (folders: import('@shared/api').FolderNode[]): void => {
      for (const folder of folders) {
        for (const item of folder.pages) {
          if (item.type === 'csv') csv.push(item.title)
          if (item.type === 'json') jsonTitles.push(item.title)
        }
        walk(folder.folders)
      }
    }
    for (const tree of Object.values(trees)) {
      for (const item of tree.pages) {
        if (item.type === 'csv') csv.push(item.title)
        if (item.type === 'json') jsonTitles.push(item.title)
      }
      walk(tree.folders)
    }
    return {
      csv: [...new Set(csv)].sort((a, b) => a.localeCompare(b)),
      json: [...new Set(jsonTitles)].sort((a, b) => a.localeCompare(b))
    }
  }, [trees])
  const [view, setView] = useState<EditorView | null>(null)
  const syntaxError = useMemo(() => {
    if (language === 'json') {
      const at = jsonErrorAt(value)
      if (!at) return null
      const line = value.slice(0, at.offset).split('\n').length
      return `Line ${line}: ${at.message}`
    }
    try {
      transform(value, {
        transforms: language === 'typescript' ? ['typescript', 'imports'] : ['imports']
      })
      return null
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Syntax error'
    }
  }, [language, value])
  const [menu, setMenu] = useState<{ x: number; y: number; pos: number } | null>(null)
  const [rename, setRename] = useState<{ pos: number; value: string } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [replaceMode, setReplaceMode] = useState(false)
  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  useEffect(() => {
    if (!view || !onRun) return
    runHandlers.set(view, onRun)
    return () => {
      runHandlers.delete(view)
    }
  }, [onRun, view])

  const navRef = useRef<(view: EditorView, pos: number) => void>(() => undefined)
  useEffect(() => {
    navRef.current = (editor, pos) => {
      const source = editor.state.doc.toString()
      const spec = language === 'json' ? null : importSpecAt(source, pos)
      if (spec) {
        const stem = spec.replace(/\.(json|csv|js|ts)$/i, '')
        for (const [spaceId, tree] of Object.entries(trees)) {
          const stack = [
            ...tree.pages,
            ...tree.folders.flatMap(function walk(
              folder: (typeof tree.folders)[number]
            ): typeof tree.pages {
              return [...folder.pages, ...folder.folders.flatMap(walk)]
            })
          ]
          const hit = stack.find((item) => item.title === spec || item.title === stem)
          if (hit) {
            void selectPage(hit.id, spaceId)
            return
          }
        }
      }
      const target = definitionAt(source, pos)
      if (!target) return
      editor.dispatch({
        selection: { anchor: target.from, head: target.to },
        scrollIntoView: true
      })
      editor.focus()
    }
  }, [language, selectPage, trees])

  const extensions = useMemo(
    () => [
      ...(language === 'json'
        ? [json(), ...jsonLint]
        : [javascript({ typescript: language === 'typescript', jsx: false })]),
      ...(language === 'json' ? [] : createPaperAutocomplete(pageTitles.csv, pageTitles.json)),
      EditorView.domEventHandlers({
        mousedown(event, editor) {
          if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return false
          const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY })
          if (pos == null) return false
          event.preventDefault()
          navRef.current(editor, pos)
          return true
        }
      }),
      runKeymap,
      search({
        top: true,
        createPanel: () => ({
          dom: document.createElement('div'),
          top: true
        })
      }),
      paperTheme(dark, ICON_ACCENT[accent]),
      syntaxHighlighting(paperHighlight(dark, ICON_ACCENT[accent]))
    ],
    [accent, dark, language, pageTitles.csv, pageTitles.json]
  )

  useEffect(() => {
    if (!active || !view) return
    view.requestMeasure()
    if (restoreFocus) view.focus()
  }, [active, restoreFocus, view])

  useEffect(() => {
    if (!active || compact) return
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onRun?.()
        return
      }
      if (compact) return
      if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'h') {
        event.preventDefault()
        if (view) {
          const selected = view.state.sliceDoc(
            view.state.selection.main.from,
            view.state.selection.main.to
          )
          if (selected && !selected.includes('\n')) setQuery(selected)
        }
        setFindOpen(true)
        setReplaceMode(event.key.toLowerCase() === 'h')
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active, compact, onRun, view])

  return (
    <div
      className={cn('relative min-h-0', compact ? 'min-h-[8.5rem]' : 'h-full')}
      onContextMenu={(event) => {
        if (!view || readOnly) return
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos == null) return
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY, pos })
      }}
    >
      {compact ? null : (
        <FindBar
          view={view}
          open={findOpen}
          replaceMode={replaceMode}
          query={query}
          replace={replace}
          onQuery={setQuery}
          onReplace={setReplace}
          onOpenChange={setFindOpen}
          onReplaceMode={setReplaceMode}
        />
      )}
      {syntaxError && !compact ? (
        <p className="absolute bottom-2 left-2 z-10 max-w-[min(36rem,calc(100%-1rem))] rounded-sm bg-paper/90 px-2 py-1 font-mono text-[11px] text-destructive/80">
          {syntaxError}
        </p>
      ) : null}
      {menu ? (
        <div
          className="paper-float fixed z-50 min-w-40 p-1"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="block w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
            onClick={() => {
              const source = view?.state.doc.toString() ?? value
              let from = menu.pos
              let to = menu.pos
              while (from > 0 && /[\w$]/.test(source[from - 1] ?? '')) from -= 1
              while (to < source.length && /[\w$]/.test(source[to] ?? '')) to += 1
              setRename({ pos: menu.pos, value: source.slice(from, to) })
              setMenu(null)
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="block w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
            onClick={() => {
              if (view) navRef.current(view, menu.pos)
              setMenu(null)
            }}
          >
            Go to definition
          </button>
          {language === 'json' && onFormat ? (
            <button
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
              onClick={() => {
                setMenu(null)
                onFormat()
              }}
            >
              Format
            </button>
          ) : null}
        </div>
      ) : null}
      {rename ? (
        <form
          className="paper-float absolute top-2 left-2 z-20 flex items-center gap-2 p-2"
          onSubmit={(event) => {
            event.preventDefault()
            const next = renameAt(value, rename.pos, rename.value.trim())
            if (next != null) onChange(next)
            setRename(null)
          }}
        >
          <input
            autoFocus
            value={rename.value}
            aria-label="New name"
            className="w-40 bg-transparent font-mono text-[13px] outline-none"
            onChange={(event) => setRename({ ...rename, value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setRename(null)
            }}
          />
        </form>
      ) : null}
      <CodeMirror
        value={value}
        height={compact ? 'auto' : '100%'}
        className={compact ? 'min-h-[8.5rem]' : 'h-full min-h-0'}
        editable={!readOnly}
        basicSetup={{
          foldGutter: true,
          highlightActiveLineGutter: false,
          lineNumbers: true,
          searchKeymap: false
        }}
        extensions={extensions}
        onCreateEditor={(next) => {
          setView(next)
          onEditorView?.(next)
        }}
        onChange={onChange}
      />
    </div>
  )
}
