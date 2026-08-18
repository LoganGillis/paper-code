import { useMemo, useState } from 'react'
import { ChartArea, ChartColumn, ChartLine } from 'lucide-react'
import type { IconColorId } from '@shared/icons'
import { ICON_ACCENT } from '@shared/icons'
import { parseCsv } from '@shared/csv'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  CHART_KINDS,
  buildPoints,
  defaultChartSpec,
  formatTick,
  inspectColumns,
  niceCeil,
  type ChartKind,
  type ChartSpec
} from '@/lib/chart-data'
import { cn } from '@/lib/utils'

const KIND_META: Record<ChartKind, { label: string; icon: typeof ChartColumn }> = {
  bar: { label: 'Bar', icon: ChartColumn },
  line: { label: 'Line', icon: ChartLine },
  area: { label: 'Area', icon: ChartArea }
}

export function CsvChart({
  content,
  spec,
  onSpecChange,
  accent,
  height = 280,
  compact = false
}: {
  content: string
  spec?: Partial<ChartSpec>
  onSpecChange?: (spec: ChartSpec) => void
  accent: IconColorId
  height?: number
  compact?: boolean
}): React.JSX.Element {
  const grid = useMemo(() => parseCsv(content), [content])
  const columns = useMemo(() => inspectColumns(grid), [grid])
  const inferred = useMemo(() => defaultChartSpec(columns), [columns])
  const resolved: ChartSpec = {
    kind: spec?.kind && CHART_KINDS.includes(spec.kind) ? spec.kind : inferred.kind,
    x: spec?.x && columns.some((column) => column.name === spec.x) ? spec.x : inferred.x,
    y: spec?.y && columns.some((column) => column.name === spec.y) ? spec.y : inferred.y
  }
  const points = useMemo(
    () => buildPoints(grid, resolved.x, resolved.y),
    [grid, resolved.x, resolved.y]
  )
  const numeric = columns.filter((column) => column.kind === 'number')
  const categories = columns.filter(
    (column) => column.kind !== 'number' || column.name !== resolved.y
  )

  function patch(next: Partial<ChartSpec>): void {
    onSpecChange?.({ ...resolved, ...next })
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ '--page-accent': ICON_ACCENT[accent] } as React.CSSProperties}
    >
      {onSpecChange ? (
        <div
          className={cn('flex flex-wrap items-center gap-1.5', compact ? 'px-2 pb-2' : 'px-4 py-2')}
        >
          <div className="flex rounded-md bg-sidebar p-0.5">
            {CHART_KINDS.map((kind) => {
              const Icon = KIND_META[kind].icon
              return (
                <Button
                  key={kind}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-6 gap-1 px-2 text-[11px]',
                    resolved.kind === kind && 'bg-paper text-foreground shadow-sm'
                  )}
                  onClick={() => patch({ kind })}
                >
                  <Icon className="size-3.5" />
                  {KIND_META[kind].label}
                </Button>
              )
            })}
          </div>
          <ColumnPick
            label="X"
            value={resolved.x}
            options={categories.map((column) => column.name)}
            onChange={(x) => patch({ x })}
          />
          <ColumnPick
            label="Y"
            value={resolved.y}
            options={numeric.map((column) => column.name)}
            onChange={(y) => patch({ y })}
          />
        </div>
      ) : null}

      <div className={cn('min-h-0 flex-1', compact ? 'px-2 pb-2' : 'px-6 pb-6')}>
        {points.length === 0 ? (
          <p className="px-2 py-8 text-sm text-muted-foreground">
            Pick a category and a number column to draw a chart.
          </p>
        ) : (
          <ChartCanvas points={points} kind={resolved.kind} height={height} />
        )}
      </div>
    </div>
  )
}

function ColumnPick({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="h-7 max-w-[11rem] gap-1.5 px-2">
          <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</span>
          <span className="truncate font-mono text-[12px]">{value || '—'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.length === 0 ? (
          <DropdownMenuItem disabled>No columns</DropdownMenuItem>
        ) : (
          options.map((option) => (
            <DropdownMenuItem key={option} onSelect={() => onChange(option)}>
              {option}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChartCanvas({
  points,
  kind,
  height
}: {
  points: { label: string; value: number }[]
  kind: ChartKind
  height: number
}): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const pad = { top: 16, right: 12, bottom: 32, left: 44 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const max = niceCeil(Math.max(...points.map((point) => point.value), 0))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((part) => part * max)
  const step = Math.max(1, Math.ceil(points.length / 7))

  const xAt = (index: number): number => {
    if (kind === 'bar') {
      const band = innerW / points.length
      return pad.left + band * index + band / 2
    }
    if (points.length === 1) return pad.left + innerW / 2
    return pad.left + (index / (points.length - 1)) * innerW
  }

  const yAt = (value: number): number => pad.top + innerH - (value / max) * innerH

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index)} ${yAt(point.value)}`)
    .join(' ')
  const area = `${line} L ${xAt(points.length - 1)} ${pad.top + innerH} L ${xAt(0)} ${pad.top + innerH} Z`
  const barW = Math.max(4, Math.min(36, (innerW / points.length) * 0.62))
  const active = hover !== null ? points[hover] : null

  return (
    <div className="relative h-full min-h-[180px] w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="img"
        aria-label="Chart"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke="currentColor"
              className="text-border/70"
              strokeWidth="1"
            />
            <text
              x={pad.left - 8}
              y={yAt(tick) + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize="10"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {points.map((point, index) =>
          index % step === 0 || index === points.length - 1 ? (
            <text
              key={`label-${point.label}-${index}`}
              x={xAt(index)}
              y={height - 10}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="10"
            >
              {point.label.length > 10 ? `${point.label.slice(0, 9)}…` : point.label}
            </text>
          ) : null
        )}

        {kind === 'area' ? <path d={area} fill="var(--page-accent)" fillOpacity="0.16" /> : null}
        {kind === 'line' || kind === 'area' ? (
          <path
            d={line}
            fill="none"
            stroke="var(--page-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : null}

        {kind === 'bar'
          ? points.map((point, index) => (
              <rect
                key={`${point.label}-${index}`}
                x={xAt(index) - barW / 2}
                y={yAt(point.value)}
                width={barW}
                height={Math.max(0, pad.top + innerH - yAt(point.value))}
                rx="3"
                fill="var(--page-accent)"
                fillOpacity={hover === index ? 0.92 : 0.78}
                onMouseEnter={() => setHover(index)}
              />
            ))
          : points.map((point, index) => (
              <circle
                key={`${point.label}-${index}`}
                cx={xAt(index)}
                cy={yAt(point.value)}
                r={hover === index ? 4.5 : 3}
                fill="var(--page-accent)"
                onMouseEnter={() => setHover(index)}
              />
            ))}

        {points.map((point, index) => (
          <rect
            key={`hit-${point.label}-${index}`}
            x={xAt(index) - innerW / points.length / 2}
            y={pad.top}
            width={Math.max(innerW / points.length, 12)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>
      {active ? (
        <div className="pointer-events-none absolute top-2 right-3 rounded-md bg-paper/95 px-2 py-1 text-[12px] shadow-sm">
          <span className="text-muted-foreground">{active.label}</span>
          <span className="ml-2 font-mono">{formatTick(active.value)}</span>
        </div>
      ) : null}
    </div>
  )
}
