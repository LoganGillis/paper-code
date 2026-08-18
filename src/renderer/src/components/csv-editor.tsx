import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseCsv, serializeCsv } from '@shared/csv'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import { isMac, modSymbol } from '@/lib/platform'

type Sel = { r0: number; c0: number; r1: number; c1: number }

function normalize(sel: Sel): Sel {
  return {
    r0: Math.min(sel.r0, sel.r1),
    c0: Math.min(sel.c0, sel.c1),
    r1: Math.max(sel.r0, sel.r1),
    c1: Math.max(sel.c0, sel.c1)
  }
}

function cloneGrid(rows: string[][]): string[][] {
  return rows.map((row) => [...row])
}

function ensureSize(rows: string[][], rowCount: number, colCount: number): string[][] {
  const next = rows.map((row) => {
    const copy = [...row]
    while (copy.length < colCount) copy.push('')
    return copy.slice(0, colCount)
  })
  while (next.length < rowCount) next.push(Array.from({ length: colCount }, () => ''))
  return next
}

function columnLabel(index: number): string {
  let value = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (value % 26)) + label
    value = Math.floor(value / 26) - 1
  } while (value >= 0)
  return label
}

function selectionText(rows: string[][], box: Sel): string {
  return rows
    .slice(box.r0, box.r1 + 1)
    .map((row) => row.slice(box.c0, box.c1 + 1).join('\t'))
    .join('\n')
}

export function CsvEditor({
  content,
  onChange,
  active = true,
  readOnly = false
}: {
  content: string
  onChange: (value: string) => void
  active?: boolean
  readOnly?: boolean
}): React.JSX.Element {
  const [rows, setRows] = useState<string[][]>(() => {
    const parsed = parseCsv(content)
    return parsed.length > 0 ? parsed : [['', '']]
  })
  const [sel, setSel] = useState<Sel>({ r0: 0, c0: 0, r1: 0, c1: 0 })
  const [editing, setEditing] = useState<{ r: number; c: number; value: string } | null>(null)
  const [fill, setFill] = useState<{ toR: number; toC: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Sel | null>(null)
  const history = useRef<{ past: string[][][]; future: string[][][] }>({ past: [], future: [] })
  const lastSent = useRef(content)

  useEffect(() => {
    if (content === lastSent.current) return
    lastSent.current = content
    const parsed = parseCsv(content)
    setRows(parsed.length > 0 ? parsed : [['', '']])
  }, [content])

  const applyGrid = useCallback(
    (next: string[][], record: boolean) => {
      if (record) {
        history.current.past.push(cloneGrid(rows))
        if (history.current.past.length > 80) history.current.past.shift()
        history.current.future = []
      }
      setRows(next)
      const serialized = serializeCsv(next)
      lastSent.current = serialized
      onChange(serialized)
    },
    [onChange, rows]
  )

  const commit = useCallback((next: string[][], record = true) => applyGrid(next, record), [applyGrid])

  const undo = useCallback(() => {
    const prev = history.current.past.pop()
    if (!prev) return
    history.current.future.push(cloneGrid(rows))
    applyGrid(prev, false)
  }, [applyGrid, rows])

  const redo = useCallback(() => {
    const next = history.current.future.pop()
    if (!next) return
    history.current.past.push(cloneGrid(rows))
    applyGrid(next, false)
  }, [applyGrid, rows])

  const bounds = normalize(sel)

  const applyFill = useCallback(
    (target: Sel) => {
      const source = normalize(sel)
      const dest = normalize(target)
      const next = cloneGrid(rows)
      const patternH = source.c1 - source.c0 + 1
      const patternV = source.r1 - source.r0 + 1
      for (let r = dest.r0; r <= dest.r1; r += 1) {
        for (let c = dest.c0; c <= dest.c1; c += 1) {
          const sample =
            rows[source.r0 + ((r - dest.r0) % patternV)]?.[
              source.c0 + ((c - dest.c0) % patternH)
            ] ?? ''
          if (!next[r]) next[r] = []
          next[r][c] = sample
        }
      }
      commit(ensureSize(next, next.length, next[0]?.length ?? 1))
      setSel(dest)
    },
    [commit, rows, sel]
  )

  const insertRow = useCallback(
    (at: number) => {
      const next = cloneGrid(rows)
      next.splice(
        at,
        0,
        Array.from({ length: rows[0]?.length ?? 1 }, () => '')
      )
      commit(next)
      setSel({ r0: at, c0: bounds.c0, r1: at, c1: bounds.c1 })
    },
    [bounds.c0, bounds.c1, commit, rows]
  )

  const insertColumn = useCallback(
    (at: number) => {
      commit(
        rows.map((row) => {
          const copy = [...row]
          copy.splice(at, 0, '')
          return copy
        })
      )
      setSel({ r0: bounds.r0, c0: at, r1: bounds.r1, c1: at })
    },
    [bounds.r0, bounds.r1, commit, rows]
  )

  const deleteRows = useCallback(() => {
    if (rows.length <= 1) return
    const next = cloneGrid(rows)
    next.splice(bounds.r0, bounds.r1 - bounds.r0 + 1)
    commit(next.length > 0 ? next : [['']])
    const r = Math.min(bounds.r0, Math.max(0, (next.length > 0 ? next.length : 1) - 1))
    setSel({ r0: r, c0: bounds.c0, r1: r, c1: bounds.c0 })
  }, [bounds, commit, rows])

  const deleteColumns = useCallback(() => {
    if ((rows[0]?.length ?? 0) <= 1) return
    const next = rows.map((row) => row.filter((_, index) => index < bounds.c0 || index > bounds.c1))
    commit(next)
    const c = Math.min(bounds.c0, Math.max(0, (next[0]?.length ?? 1) - 1))
    setSel({ r0: bounds.r0, c0: c, r1: bounds.r0, c1: c })
  }, [bounds, commit, rows])

  const copySelection = useCallback(() => {
    void navigator.clipboard.writeText(selectionText(rows, bounds))
  }, [bounds, rows])

  const pasteAtSelection = useCallback(async () => {
    const text = await navigator.clipboard.readText()
    const pasted = text
      .replace(/\r/g, '')
      .split('\n')
      .filter((line, index, all) => !(index === all.length - 1 && line === ''))
      .map((line) => line.split('\t'))
    if (pasted.length === 0) return
    const next = cloneGrid(rows)
    pasted.forEach((line, rOffset) => {
      line.forEach((cell, cOffset) => {
        const r = bounds.r0 + rOffset
        const c = bounds.c0 + cOffset
        while (next.length <= r) next.push(Array.from({ length: next[0]?.length ?? 1 }, () => ''))
        next.forEach((row) => {
          while (row.length <= c) row.push('')
        })
        next[r][c] = cell
      })
    })
    commit(ensureSize(next, next.length, Math.max(...next.map((row) => row.length))))
  }, [bounds.r0, bounds.c0, commit, rows])

  const clearSelection = useCallback(() => {
    const next = cloneGrid(rows)
    for (let r = bounds.r0; r <= bounds.r1; r += 1) {
      for (let c = bounds.c0; c <= bounds.c1; c += 1) next[r][c] = ''
    }
    commit(next)
  }, [bounds, commit, rows])

  const duplicateRows = useCallback(() => {
    const copies = rows.slice(bounds.r0, bounds.r1 + 1).map((row) => [...row])
    const next = cloneGrid(rows)
    next.splice(bounds.r1 + 1, 0, ...copies)
    commit(next)
    setSel({
      r0: bounds.r1 + 1,
      c0: bounds.c0,
      r1: bounds.r1 + copies.length,
      c1: bounds.c1
    })
  }, [bounds, commit, rows])

  const selectAll = useCallback(() => {
    setSel({ r0: 0, c0: 0, r1: rows.length - 1, c1: (rows[0]?.length ?? 1) - 1 })
  }, [rows])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement
      if (
        target.closest('input, textarea, [contenteditable="true"]') &&
        !editing &&
        !rootRef.current?.contains(target)
      ) {
        return
      }
      const key = event.key
      if (editing) {
        if (key === 'Enter') {
          event.preventDefault()
          const next = cloneGrid(rows)
          next[editing.r][editing.c] = editing.value
          commit(next)
          setEditing(null)
          setSel({
            r0: Math.min(editing.r + 1, rows.length - 1),
            c0: editing.c,
            r1: Math.min(editing.r + 1, rows.length - 1),
            c1: editing.c
          })
        }
        if (key === 'Escape') setEditing(null)
        return
      }

      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelection()
        return
      }
      if (readOnly) return
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'v') {
        event.preventDefault()
        void pasteAtSelection()
        return
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAll()
        return
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'z') {
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }

      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault()
        clearSelection()
        return
      }

      if (key === 'Enter') {
        event.preventDefault()
        setEditing({ r: bounds.r0, c: bounds.c0, value: rows[bounds.r0][bounds.c0] ?? '' })
        return
      }

      if (key === 'Tab') {
        event.preventDefault()
        const c = Math.min(rows[0].length - 1, bounds.c0 + (event.shiftKey ? -1 : 1))
        setSel({ r0: bounds.r0, c0: c, r1: bounds.r0, c1: c })
        return
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault()
        const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0
        const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0
        const r = Math.max(0, Math.min(rows.length - 1, (event.shiftKey ? sel.r1 : bounds.r0) + dr))
        const c = Math.max(
          0,
          Math.min(rows[0].length - 1, (event.shiftKey ? sel.c1 : bounds.c0) + dc)
        )
        setSel(event.shiftKey ? { ...sel, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c })
        return
      }

      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setEditing({ r: bounds.r0, c: bounds.c0, value: key })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    active,
    bounds,
    clearSelection,
    commit,
    copySelection,
    editing,
    pasteAtSelection,
    readOnly,
    redo,
    rows,
    sel,
    selectAll,
    undo
  ])

  const rangeClass = useMemo(() => normalize(sel), [sel])
  const shortcut = isMac() ? (key: string) => `⌘${key}` : (key: string) => `${modSymbol()}+${key}`

  useEffect(() => {
    const onUp = (): void => {
      dragRef.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  useEffect(() => {
    if (active) rootRef.current?.focus()
  }, [active])

  const selectRow = (r: number, extend: boolean): void => {
    const lastC = (rows[0]?.length ?? 1) - 1
    setSel(extend ? { ...sel, r1: r, c0: 0, c1: lastC } : { r0: r, c0: 0, r1: r, c1: lastC })
  }

  const selectColumn = (c: number, extend: boolean): void => {
    const lastR = rows.length - 1
    setSel(extend ? { ...sel, c1: c, r0: 0, r1: lastR } : { r0: 0, c0: c, r1: lastR, c1: c })
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
      tabIndex={0}
    >
      {readOnly ? null : (
      <div className="flex flex-wrap gap-1 border-b border-border/60 px-3 py-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => insertRow(bounds.r0)}>
          Insert row
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={deleteRows}>
          Delete row
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => insertColumn(bounds.c0)}>
          Insert column
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={deleteColumns}>
          Delete column
        </Button>
      </div>
      )}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto select-none">
            <table className="w-max min-w-full border-collapse text-[13px] select-none">
              <thead className="csv-head sticky top-0 z-10">
                <tr>
                  <th
                    className="w-10 cursor-pointer border-b border-r border-border/50 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectAll()
                      rootRef.current?.focus()
                    }}
                  />
                  {rows[0]?.map((_, c) => (
                    <th
                      key={c}
                      className={cn(
                        'min-w-28 cursor-pointer border-b border-r border-border/50 px-2 py-1 text-left text-[11px] font-medium text-muted-foreground hover:bg-accent/60',
                        rangeClass.c0 === c &&
                          rangeClass.c1 === c &&
                          rangeClass.r0 === 0 &&
                          rangeClass.r1 === rows.length - 1 &&
                          'bg-accent/70'
                      )}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        selectColumn(c, event.shiftKey)
                        rootRef.current?.focus()
                      }}
                    >
                      {columnLabel(c)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    <th
                      className="csv-gutter cursor-pointer border-b border-r border-border/50 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent/60"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        selectRow(r, event.shiftKey)
                        rootRef.current?.focus()
                      }}
                    >
                      {r + 1}
                    </th>
                    {row.map((cell, c) => {
                      const selected =
                        r >= rangeClass.r0 &&
                        r <= rangeClass.r1 &&
                        c >= rangeClass.c0 &&
                        c <= rangeClass.c1
                      const isEdit = editing?.r === r && editing?.c === c
                      const isAnchor = r === rangeClass.r1 && c === rangeClass.c1
                      return (
                        <td
                          key={c}
                          className={cn(
                            'relative min-w-28 border-b border-r border-border/40 px-2 py-1 align-top transition-colors duration-100',
                            selected && 'csv-cell-selected',
                            r === 0 && 'font-medium'
                          )}
                          onMouseDown={(event) => {
                            if ((event.target as HTMLElement).dataset.handle) return
                            if (event.button !== 0) return
                            event.preventDefault()
                            rootRef.current?.focus()
                            const next = event.shiftKey
                              ? { ...sel, r1: r, c1: c }
                              : { r0: r, c0: c, r1: r, c1: c }
                            setSel(next)
                            dragRef.current = next
                            setEditing(null)
                          }}
                          onMouseEnter={() => {
                            if (!dragRef.current) return
                            setSel({ ...dragRef.current, r1: r, c1: c })
                          }}
                          onDoubleClick={() => {
                            if (!readOnly) setEditing({ r, c, value: cell })
                          }}
                        >
                          <span
                            className={cn(
                              'block min-h-5 whitespace-nowrap',
                              isEdit && 'invisible'
                            )}
                          >
                            {cell}
                          </span>
                          {isEdit ? (
                            <input
                              autoFocus
                              value={editing.value}
                              className="absolute inset-0 min-w-0 bg-transparent px-2 py-1 outline-none select-text"
                              onChange={(event) => setEditing({ r, c, value: event.target.value })}
                              onBlur={() => {
                                const next = cloneGrid(rows)
                                next[r][c] = editing.value
                                commit(next)
                                setEditing(null)
                              }}
                            />
                          ) : null}
                          {isAnchor ? (
                            <span
                              data-handle="fill"
                              className="csv-fill absolute -right-1 -bottom-1 size-2 cursor-crosshair rounded-sm"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                const onMove = (move: MouseEvent): void => {
                                  const el = document.elementFromPoint(move.clientX, move.clientY)
                                  const td = el?.closest('td')
                                  if (!td) return
                                  const tr = td.parentElement
                                  if (!tr) return
                                  const nextC = [...tr.children].indexOf(td) - 1
                                  const nextR = [...tr.parentElement!.children].indexOf(tr)
                                  if (nextC >= 0 && nextR >= 0) setFill({ toR: nextR, toC: nextC })
                                }
                                const onUp = (): void => {
                                  window.removeEventListener('mousemove', onMove)
                                  window.removeEventListener('mouseup', onUp)
                                  setFill((current) => {
                                    if (current) {
                                      applyFill({
                                        r0: sel.r0,
                                        c0: sel.c0,
                                        r1: current.toR,
                                        c1: current.toC
                                      })
                                    }
                                    return null
                                  })
                                }
                                window.addEventListener('mousemove', onMove)
                                window.addEventListener('mouseup', onUp)
                              }}
                            />
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => insertRow(bounds.r0)}>Insert row above</ContextMenuItem>
          <ContextMenuItem onSelect={() => insertRow(bounds.r1 + 1)}>
            Insert row below
          </ContextMenuItem>
          <ContextMenuItem onSelect={duplicateRows}>Duplicate row</ContextMenuItem>
          <ContextMenuItem onSelect={deleteRows}>Delete row</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => insertColumn(bounds.c0)}>
            Insert column left
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => insertColumn(bounds.c1 + 1)}>
            Insert column right
          </ContextMenuItem>
          <ContextMenuItem onSelect={deleteColumns}>Delete column</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={copySelection}>
            Copy
            <ContextMenuShortcut>{shortcut('C')}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void pasteAtSelection()}>
            Paste
            <ContextMenuShortcut>{shortcut('V')}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={clearSelection}>
            Clear
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={selectAll}>
            Select all
            <ContextMenuShortcut>{shortcut('A')}</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {fill ? (
        <p className="px-3 py-1 text-[11px] text-muted-foreground">
          Fill to {columnLabel(fill.toC)}
          {fill.toR + 1}
        </p>
      ) : null}
    </div>
  )
}
