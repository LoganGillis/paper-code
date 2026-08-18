import { useEffect, useMemo, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import {
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery
} from '@codemirror/search'
import { CaseSensitive, ChevronDown, ChevronUp, Regex, WholeWord, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import { modSymbol } from '@/lib/platform'

function matchInfo(
  view: EditorView | null,
  query: SearchQuery,
  search: string
): { current: number; total: number } {
  if (!view || !search || !query.valid) return { current: 0, total: 0 }
  let total = 0
  let current = 0
  const from = view.state.selection.main.from
  const cursor = query.getCursor(view.state)
  for (let item = cursor.next(); !item.done; item = cursor.next()) {
    total += 1
    if (item.value.from <= from) current = total
  }
  return { current: total === 0 ? 0 : current, total }
}

export function FindBar({
  view,
  open,
  replaceMode,
  query,
  replace,
  onQuery,
  onReplace,
  onOpenChange,
  onReplaceMode
}: {
  view: EditorView | null
  open: boolean
  replaceMode: boolean
  query: string
  replace: string
  onQuery: (value: string) => void
  onReplace: (value: string) => void
  onOpenChange: (open: boolean) => void
  onReplaceMode: (open: boolean) => void
}): React.JSX.Element | null {
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [regexp, setRegexp] = useState(false)
  const [tick, setTick] = useState(0)

  const searchQuery = useMemo(
    () =>
      new SearchQuery({
        search: query,
        replace,
        caseSensitive,
        wholeWord,
        regexp,
        literal: !regexp
      }),
    [caseSensitive, query, regexp, replace, wholeWord]
  )

  useEffect(() => {
    if (!view) return
    view.dispatch({ effects: setSearchQuery.of(searchQuery) })
  }, [searchQuery, view])

  useEffect(() => {
    if (!view || !open) return
    const onUpdate = (): void => setTick((value) => value + 1)
    view.dom.addEventListener('keyup', onUpdate)
    view.dom.addEventListener('mouseup', onUpdate)
    return () => {
      view.dom.removeEventListener('keyup', onUpdate)
      view.dom.removeEventListener('mouseup', onUpdate)
    }
  }, [open, view])

  const matches = useMemo(
    () => matchInfo(view, searchQuery, query),
    // tick forces a recount after navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, searchQuery, tick, view, view?.state.selection.main.from]
  )

  if (!open) return null

  return (
    <div
      className={cn(
        'paper-float animate-in fade-in slide-in-from-top-1 absolute top-3 right-3 z-20 w-[min(24rem,calc(100%-1.5rem))] p-2 duration-150'
      )}
    >
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Input
            autoFocus
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Find"
            className="h-8 pr-16"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && view) {
                event.preventDefault()
                if (event.shiftKey) findPrevious(view)
                else findNext(view)
                setTick((value) => value + 1)
              }
              if (event.key === 'Escape') onOpenChange(false)
            }}
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
            {query ? `${matches.current}/${matches.total}` : '0/0'}
          </span>
        </div>
        <Button
          type="button"
          variant={caseSensitive ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          aria-label="Match case"
          aria-pressed={caseSensitive}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          <CaseSensitive className="size-4" />
        </Button>
        <Button
          type="button"
          variant={wholeWord ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          aria-label="Whole word"
          aria-pressed={wholeWord}
          onClick={() => setWholeWord((value) => !value)}
        >
          <WholeWord className="size-4" />
        </Button>
        <Button
          type="button"
          variant={regexp ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          aria-label="Regular expression"
          aria-pressed={regexp}
          onClick={() => setRegexp((value) => !value)}
        >
          <Regex className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Previous"
          onClick={() => {
            if (view) findPrevious(view)
            setTick((value) => value + 1)
          }}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Next"
          onClick={() => {
            if (view) findNext(view)
            setTick((value) => value + 1)
          }}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Close find"
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" />
        </Button>
      </div>

      {replaceMode ? (
        <div className="mt-2 flex items-center gap-1.5">
          <Input
            value={replace}
            onChange={(event) => onReplace(event.target.value)}
            placeholder="Replace"
            className="h-8 flex-1"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && view) {
                event.preventDefault()
                replaceNext(view)
                setTick((value) => value + 1)
              }
              if (event.key === 'Escape') onOpenChange(false)
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (view) replaceNext(view)
              setTick((value) => value + 1)
            }}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (view) replaceAll(view)
              setTick((value) => value + 1)
            }}
          >
            All
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2 text-muted-foreground"
          onClick={() => onReplaceMode(true)}
        >
          Replace
          <KbdGroup className="ml-1.5">
            <Kbd>{modSymbol()}</Kbd>
            <Kbd>H</Kbd>
          </KbdGroup>
        </Button>
      )}
    </div>
  )
}
