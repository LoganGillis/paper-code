import { useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { createPaperAutocomplete } from '@/lib/paper-completions'
import { useWorkspace } from '@/lib/workspace'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { search } from '@codemirror/search'
import { tags } from '@lezer/highlight'
import type { IconColorId } from '@shared/icons'
import { ICON_ACCENT } from '@shared/icons'
import { FindBar } from '@/components/find-bar'
import { useTheme } from '@/components/theme-provider'

function paperHighlight(dark: boolean): HighlightStyle {
  return HighlightStyle.define([
    { tag: tags.comment, color: dark ? '#9a8f7c' : '#8a7d6b', fontStyle: 'italic' },
    { tag: tags.keyword, color: dark ? '#d4a27f' : '#8b4d2a' },
    { tag: tags.string, color: dark ? '#b7c99a' : '#4d6b3c' },
    { tag: tags.number, color: dark ? '#d7b46a' : '#8a5a18' },
    { tag: tags.function(tags.variableName), color: dark ? '#c9b08b' : '#5c4630' },
    { tag: tags.typeName, color: dark ? '#c4a882' : '#6b5340' },
    { tag: tags.bool, color: dark ? '#d4a27f' : '#8b4d2a' },
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
  const selection = `color-mix(in oklab, ${accent} ${dark ? 38 : 28}%, transparent)`
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        color: dark ? '#ece4d6' : '#32281f',
        fontSize: '12.5px'
      },
      '.cm-scroller': {
        overflow: 'auto'
      },
      '.cm-content': {
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        caretColor: dark ? '#ece4d6' : '#32281f',
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
        backgroundColor: dark ? 'rgba(255,248,236,0.04)' : 'rgba(50,40,30,0.035)'
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent'
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
        borderLeftColor: dark ? '#ece4d6' : '#32281f'
      },
      '.cm-searchMatch': {
        backgroundColor: dark ? 'rgba(215,180,106,0.35)' : 'rgba(212,168,80,0.35)'
      },
      '.cm-searchMatch-selected': {
        backgroundColor: dark ? 'rgba(212,162,127,0.55)' : 'rgba(180,120,50,0.4)'
      }
    },
    { dark }
  )
}

export function CodeEditor({
  value,
  language,
  onChange,
  active = true,
  accent = 'slate',
  onRun,
  restoreFocus = false
}: {
  value: string
  language: 'javascript' | 'typescript'
  onChange: (value: string) => void
  active?: boolean
  accent?: IconColorId
  onRun?: () => void
  restoreFocus?: boolean
}): React.JSX.Element {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const { trees } = useWorkspace()
  const csvTitles = useMemo(() => {
    const titles: string[] = []
    const walk = (folders: import('@shared/api').FolderNode[]): void => {
      for (const folder of folders) {
        for (const item of folder.pages) if (item.type === 'csv') titles.push(item.title)
        walk(folder.folders)
      }
    }
    for (const tree of Object.values(trees)) {
      for (const item of tree.pages) if (item.type === 'csv') titles.push(item.title)
      walk(tree.folders)
    }
    return [...new Set(titles)].sort((a, b) => a.localeCompare(b))
  }, [trees])
  const [view, setView] = useState<EditorView | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [replaceMode, setReplaceMode] = useState(false)
  const [query, setQuery] = useState('')
  const [replace, setReplace] = useState('')
  useEffect(() => {
    if (!view || !onRun) return
    runHandlers.set(view, onRun)
    return () => {
      runHandlers.delete(view)
    }
  }, [onRun, view])

  const extensions = useMemo(
    () => [
      javascript({ typescript: language === 'typescript', jsx: false }),
      ...createPaperAutocomplete(csvTitles),
      runKeymap,
      search({
        top: true,
        createPanel: () => ({
          dom: document.createElement('div'),
          top: true
        })
      }),
      paperTheme(dark, ICON_ACCENT[accent]),
      syntaxHighlighting(paperHighlight(dark))
    ],
    [accent, csvTitles, dark, language]
  )

  useEffect(() => {
    if (!active || !view) return
    view.requestMeasure()
    if (restoreFocus) view.focus()
  }, [active, restoreFocus, view])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        onRun?.()
        return
      }
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
  }, [active, onRun, view])

  return (
    <div className="relative h-full min-h-0">
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
      <CodeMirror
        value={value}
        height="100%"
        className="h-full min-h-0"
        basicSetup={{
          foldGutter: false,
          highlightActiveLineGutter: false,
          lineNumbers: true,
          searchKeymap: false
        }}
        extensions={extensions}
        onCreateEditor={(next) => setView(next)}
        onChange={onChange}
      />
    </div>
  )
}
