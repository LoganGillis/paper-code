export type ChartKind = 'bar' | 'line' | 'area'

export type ChartSpec = {
  kind: ChartKind
  x: string
  y: string
}

export type ChartColumn = {
  name: string
  index: number
  kind: 'number' | 'date' | 'text'
}

export type ChartPoint = {
  label: string
  value: number
}

export const CHART_KINDS: ChartKind[] = ['bar', 'line', 'area']

export function parseNumber(value: string): number | null {
  const trimmed = value.trim().replace(/[$,]/g, '')
  if (!trimmed) return null
  const next = Number(trimmed)
  return Number.isFinite(next) ? next : null
}

function looksLikeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value.trim())
}

export function inspectColumns(grid: string[][]): ChartColumn[] {
  if (grid.length === 0) return []
  const [header, ...body] = grid
  return header.map((raw, index) => {
    const name = raw.trim() || `Column ${index + 1}`
    const samples = body
      .map((row) => (row[index] ?? '').trim())
      .filter((cell) => cell.length > 0)
      .slice(0, 32)
    const numeric = samples.filter((cell) => parseNumber(cell) !== null)
    const dates = samples.filter(looksLikeDate)
    let kind: ChartColumn['kind'] = 'text'
    if (samples.length > 0 && dates.length >= samples.length * 0.7) kind = 'date'
    else if (samples.length > 0 && numeric.length >= samples.length * 0.7) kind = 'number'
    return { name, index, kind }
  })
}

export function defaultChartSpec(columns: ChartColumn[]): ChartSpec {
  const y = columns.find((column) => column.kind === 'number')
  const x =
    columns.find((column) => column.kind === 'date') ??
    columns.find((column) => column.kind === 'text') ??
    columns.find((column) => column.name !== y?.name) ??
    columns[0]
  return {
    kind: x?.kind === 'date' ? 'line' : 'bar',
    x: x?.name ?? '',
    y: y?.name ?? ''
  }
}

export function buildPoints(grid: string[][], xName: string, yName: string): ChartPoint[] {
  const columns = inspectColumns(grid)
  const x = columns.find((column) => column.name === xName)
  const y = columns.find((column) => column.name === yName)
  if (!x || !y || grid.length < 2) return []

  const grouped = new Map<string, { value: number; sort: number }>()
  for (const row of grid.slice(1)) {
    const label = (row[x.index] ?? '').trim()
    if (!label) continue
    const value = parseNumber(row[y.index] ?? '')
    if (value === null) continue
    const sort =
      x.kind === 'date'
        ? Date.parse(label) || 0
        : x.kind === 'number'
          ? (parseNumber(label) ?? 0)
          : grouped.size
    const prev = grouped.get(label)
    grouped.set(label, { value: (prev?.value ?? 0) + value, sort: prev?.sort ?? sort })
  }

  const points = [...grouped.entries()].map(([label, item]) => ({
    label,
    value: item.value,
    sort: item.sort
  }))
  if (x.kind === 'date' || x.kind === 'number') {
    points.sort((a, b) => a.sort - b.sort)
  }
  return points.map(({ label, value }) => ({ label, value }))
}

export function niceCeil(value: number): number {
  if (value <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(value))
  const n = value / exp
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * exp
}

export function formatTick(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${trimFloat(value / 1_000_000)}m`
  if (abs >= 1000) return `${trimFloat(value / 1000)}k`
  return trimFloat(value)
}

function trimFloat(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.0+$/, '')
}

export function loadChartSpec(pageId: string): ChartSpec | null {
  try {
    const raw = window.localStorage.getItem(`paper.chart.${pageId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ChartSpec>
    if (parsed.kind !== 'bar' && parsed.kind !== 'line' && parsed.kind !== 'area') return null
    if (typeof parsed.x !== 'string' || typeof parsed.y !== 'string') return null
    return { kind: parsed.kind, x: parsed.x, y: parsed.y }
  } catch {
    return null
  }
}

export function saveChartSpec(pageId: string, spec: ChartSpec): void {
  window.localStorage.setItem(`paper.chart.${pageId}`, JSON.stringify(spec))
}
