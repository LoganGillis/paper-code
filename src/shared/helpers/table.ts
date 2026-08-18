import { inspect } from 'node:util'
import { parseCsv, serializeCsv } from '../csv'

export type Row = Record<string, unknown>
export type AggName = 'sum' | 'mean' | 'min' | 'max' | 'count' | 'first' | 'last' | 'median'
export type AggSpec = Record<string, AggName | ((rows: Row[]) => unknown)>

export function coerceCell(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^[+-]?\d+$/.test(trimmed)) return Number(trimmed)
  if (/^[+-]?(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return Number(trimmed)
  return value
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const an = asNumber(a)
  const bn = asNumber(b)
  if (an != null && bn != null) return an - bn
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function pick(row: Row, columns: string[]): Row {
  const next: Row = {}
  for (const column of columns) next[column] = row[column]
  return next
}

function applyAgg(
  rows: Row[],
  column: string,
  how: AggName | ((group: Row[]) => unknown)
): unknown {
  if (typeof how === 'function') return how(rows)
  if (how === 'count') return rows.length
  if (how === 'first') return rows[0]?.[column]
  if (how === 'last') return rows[rows.length - 1]?.[column]
  const nums = rows
    .map((row) => asNumber(row[column]))
    .filter((value): value is number => value != null)
  if (how === 'sum') return nums.reduce((total, value) => total + value, 0)
  if (how === 'mean')
    return nums.length === 0 ? null : nums.reduce((total, value) => total + value, 0) / nums.length
  if (how === 'min') {
    if (nums.length > 0) return Math.min(...nums)
    const values = rows.map((row) => row[column]).filter((value) => value != null && value !== '')
    return values.length === 0
      ? null
      : values.reduce((best, value) => (compareValues(value, best) < 0 ? value : best))
  }
  if (how === 'max') {
    if (nums.length > 0) return Math.max(...nums)
    const values = rows.map((row) => row[column]).filter((value) => value != null && value !== '')
    return values.length === 0
      ? null
      : values.reduce((best, value) => (compareValues(value, best) > 0 ? value : best))
  }
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? null)
}

function keyOf(row: Row, columns: string[]): string {
  return columns.map((column) => JSON.stringify(row[column] ?? null)).join('\0')
}

export class $Grouped {
  readonly keys: string[]
  readonly groups: Row[][]

  constructor(keys: string[], groups: Row[][]) {
    this.keys = keys
    this.groups = groups
  }

  agg(spec: AggSpec): $Table {
    return $Table.fromRows(
      this.groups.map((group) => {
        const row: Row = {}
        for (const key of this.keys) row[key] = group[0]?.[key]
        for (const [column, how] of Object.entries(spec)) {
          row[column] = applyAgg(group, column, how)
        }
        return row
      })
    )
  }

  count(): $Table {
    return this.agg({ count: 'count' })
  }

  sum(column: string): $Table {
    return this.agg({ [column]: 'sum' })
  }

  mean(column: string): $Table {
    return this.agg({ [column]: 'mean' })
  }
}

export class $Table {
  readonly rows: Row[]

  constructor(rows: Row[] = []) {
    this.rows = rows
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === 'default') return target
        if (typeof prop === 'string' && /^\d+$/.test(prop)) return target.rows[Number(prop)]
        return Reflect.get(target, prop, receiver)
      }
    })
  }

  static fromRows(rows: Iterable<Row>): $Table {
    return new $Table(Array.from(rows))
  }

  static fromCsv(text: string): $Table {
    const grid = parseCsv(text)
    if (grid.length === 0) return new $Table()
    const [header, ...body] = grid
    const columns = header.map((name, index) => name.trim() || `col${index + 1}`)
    return new $Table(
      body.map((line) => {
        const row: Row = {}
        columns.forEach((column, index) => {
          row[column] = coerceCell(line[index] ?? '')
        })
        return row
      })
    )
  }

  get length(): number {
    return this.rows.length
  }

  get columns(): string[] {
    const seen = new Set<string>()
    for (const row of this.rows) {
      for (const key of Object.keys(row)) seen.add(key)
    }
    return [...seen]
  }

  get shape(): [number, number] {
    return [this.length, this.columns.length]
  }

  [Symbol.iterator](): IterableIterator<Row> {
    return this.rows[Symbol.iterator]()
  }

  head(count = 5): $Table {
    return new $Table(this.rows.slice(0, count))
  }

  tail(count = 5): $Table {
    return new $Table(this.rows.slice(Math.max(0, this.length - count)))
  }

  select(...columns: string[]): $Table {
    return new $Table(this.rows.map((row) => pick(row, columns)))
  }

  drop(...columns: string[]): $Table {
    const remove = new Set(columns)
    return new $Table(
      this.rows.map((row) => {
        const next: Row = {}
        for (const [key, value] of Object.entries(row)) {
          if (!remove.has(key)) next[key] = value
        }
        return next
      })
    )
  }

  rename(map: Record<string, string>): $Table {
    return new $Table(
      this.rows.map((row) => {
        const next: Row = {}
        for (const [key, value] of Object.entries(row)) next[map[key] ?? key] = value
        return next
      })
    )
  }

  where(predicate: ((row: Row, index: number) => unknown) | Row | string, value?: unknown): $Table {
    if (typeof predicate === 'function') {
      return new $Table(this.rows.filter((row, index) => Boolean(predicate(row, index))))
    }
    if (typeof predicate === 'string') {
      return new $Table(this.rows.filter((row) => row[predicate] === value))
    }
    return new $Table(
      this.rows.filter((row) =>
        Object.entries(predicate).every(([key, expected]) => row[key] === expected)
      )
    )
  }

  sort(column: string | string[], direction: 'asc' | 'desc' = 'asc'): $Table {
    const columns = Array.isArray(column) ? column : [column]
    const sign = direction === 'desc' ? -1 : 1
    return new $Table(
      [...this.rows].sort((left, right) => {
        for (const key of columns) {
          const cmp = compareValues(left[key], right[key])
          if (cmp !== 0) return cmp * sign
        }
        return 0
      })
    )
  }

  unique(...columns: string[]): $Table {
    const keys = columns.length > 0 ? columns : this.columns
    const seen = new Set<string>()
    const rows: Row[] = []
    for (const row of this.rows) {
      const key = keyOf(row, keys)
      if (seen.has(key)) continue
      seen.add(key)
      rows.push(columns.length > 0 ? pick(row, columns) : row)
    }
    return new $Table(rows)
  }

  assign(computeds: Record<string, unknown | ((row: Row, index: number) => unknown)>): $Table {
    return new $Table(
      this.rows.map((row, index) => {
        const next = { ...row }
        for (const [column, value] of Object.entries(computeds)) {
          next[column] = typeof value === 'function' ? value(row, index) : value
        }
        return next
      })
    )
  }

  fill(values: Record<string, unknown> | string, fallback?: unknown): $Table {
    const map = typeof values === 'string' ? { [values]: fallback } : values
    return new $Table(
      this.rows.map((row) => {
        const next = { ...row }
        for (const [column, value] of Object.entries(map)) {
          if (next[column] == null || next[column] === '') next[column] = value
        }
        return next
      })
    )
  }

  dropNull(...columns: string[]): $Table {
    const keys = columns.length > 0 ? columns : this.columns
    return new $Table(
      this.rows.filter((row) => keys.every((key) => row[key] != null && row[key] !== ''))
    )
  }

  sample(count: number): $Table {
    const copy = [...this.rows]
    const take = Math.min(count, copy.length)
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const swap = copy[i]
      copy[i] = copy[j] ?? copy[i]
      copy[j] = swap ?? copy[j]
    }
    return new $Table(copy.slice(0, take))
  }

  groupBy(...columns: string[]): $Grouped {
    const buckets = new Map<string, Row[]>()
    for (const row of this.rows) {
      const key = keyOf(row, columns)
      const bucket = buckets.get(key)
      if (bucket) bucket.push(row)
      else buckets.set(key, [row])
    }
    return new $Grouped(columns, [...buckets.values()])
  }

  sum(column: string): number {
    return this.rows.reduce((total, row) => total + (asNumber(row[column]) ?? 0), 0)
  }

  mean(column: string): number | null {
    const nums = this.rows
      .map((row) => asNumber(row[column]))
      .filter((value): value is number => value != null)
    return nums.length === 0 ? null : nums.reduce((total, value) => total + value, 0) / nums.length
  }

  min(column: string): unknown {
    return applyAgg(this.rows, column, 'min')
  }

  max(column: string): unknown {
    return applyAgg(this.rows, column, 'max')
  }

  median(column: string): number | null {
    const value = applyAgg(this.rows, column, 'median')
    return typeof value === 'number' ? value : null
  }

  count(): number {
    return this.length
  }

  innerJoin(other: $Table, on: string | { left: string; right: string }): $Table {
    return this.joinWith(other, on, 'inner')
  }

  leftJoin(other: $Table, on: string | { left: string; right: string }): $Table {
    return this.joinWith(other, on, 'left')
  }

  private joinWith(
    other: $Table,
    on: string | { left: string; right: string },
    how: 'inner' | 'left'
  ): $Table {
    const leftKey = typeof on === 'string' ? on : on.left
    const rightKey = typeof on === 'string' ? on : on.right
    const index = new Map<string, Row[]>()
    for (const row of other.rows) {
      const key = JSON.stringify(row[rightKey] ?? null)
      const bucket = index.get(key)
      if (bucket) bucket.push(row)
      else index.set(key, [row])
    }
    const rows: Row[] = []
    for (const left of this.rows) {
      const matches = index.get(JSON.stringify(left[leftKey] ?? null)) ?? []
      if (matches.length === 0) {
        if (how === 'left') rows.push({ ...left })
        continue
      }
      for (const right of matches) {
        const merged: Row = { ...left }
        for (const [key, value] of Object.entries(right)) {
          if (key === rightKey) continue
          merged[key in merged ? `${key}_right` : key] = value
        }
        rows.push(merged)
      }
    }
    return new $Table(rows)
  }

  concat(other: $Table | Iterable<Row>): $Table {
    const extra = other instanceof $Table ? other.rows : Array.from(other)
    return new $Table([...this.rows, ...extra])
  }

  toObjects(): Row[] {
    return this.rows.map((row) => ({ ...row }))
  }

  toCsv(): string {
    const columns = this.columns
    const grid = [
      columns,
      ...this.rows.map((row) =>
        columns.map((column) => (row[column] == null ? '' : String(row[column])))
      )
    ]
    return serializeCsv(grid)
  }

  [inspect.custom](): string {
    const columns = this.columns
    const preview = this.rows.slice(0, 8)
    const widths = columns.map((column) =>
      Math.min(
        22,
        Math.max(column.length, ...preview.map((row) => String(row[column] ?? '').length))
      )
    )
    const cell = (value: unknown, width: number): string => {
      const text = String(value ?? '')
      return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text.padEnd(width)
    }
    const header = columns.map((column, index) => cell(column, widths[index] ?? 8)).join('  ')
    const lines = preview.map((row) =>
      columns.map((column, index) => cell(row[column], widths[index] ?? 8)).join('  ')
    )
    const more = this.length > preview.length ? `\n  … ${this.length - preview.length} more` : ''
    return `$Table(${this.length} × ${columns.length})\n  ${header}\n  ${lines.join('\n  ')}${more}`
  }
}
