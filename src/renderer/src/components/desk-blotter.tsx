import { useMemo, useState } from 'react'
import { ICON_ACCENT } from '@shared/icons'
import type { Space } from '@shared/api'
import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { TypeBadge } from '@/components/type-badge'
import { dailyTitle, formatClock, sameDay, weekDays, weekdayName, weekdayShort } from '@/lib/desk'
import { collectPages } from '@/lib/pages'
import { cn } from '@/lib/utils'
import { useNow } from '@/lib/use-now'
import { useWorkspace } from '@/lib/workspace'

export function DeskBlotter({ space }: { space: Space }): React.JSX.Element {
  const { trees, createPage, openDaily, selectPage } = useWorkspace()
  const now = useNow()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const pages = useMemo(
    () =>
      collectPages({ [space.id]: trees[space.id] })
        .map((hit) => hit.page)
        .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [space.id, trees]
  )

  const dated = useMemo(() => new Set(pages.map((page) => page.title)), [pages])
  const recent = pages.slice(0, 6)
  const days = weekDays(now)

  async function onCapture(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const title = draft.trim()
    if (!title || saving) return
    setSaving(true)
    try {
      setDraft('')
      await createPage(space.id, 'markdown', title)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className="accent-select flex h-full min-h-0 flex-col overflow-auto select-text"
      style={{ '--page-accent': ICON_ACCENT[space.iconColor] } as React.CSSProperties}
    >
      <header className="mx-auto w-full max-w-3xl shrink-0 px-10 pt-10 pb-4">
        <div className="mb-3 flex items-center gap-3">
          <IconBadge icon={space.icon} color={space.iconColor} className="size-9" />
          <h1 className="w-full text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em]">
            {dailyTitle(now)}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {weekdayName(now)}
          <span className="mx-2 text-border">·</span>
          <span className="font-mono text-[12px] tabular-nums">{formatClock(now)}</span>
        </p>
      </header>

      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 px-10 pr-12 pb-8">
        <div className="mb-8 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const title = dailyTitle(day)
            const today = sameDay(day, now)
            const written = dated.has(title)
            return (
              <button
                key={title}
                type="button"
                className={cn(
                  'flex flex-col items-center rounded-md py-2 text-[13px] transition-colors duration-150',
                  today
                    ? `icon-chip icon-chip-${space.iconColor}`
                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                )}
                onClick={() => void openDaily(space.id, day)}
              >
                <span className="text-[10px] font-medium tracking-[0.14em] uppercase">
                  {weekdayShort(day)}
                </span>
                <span className="mt-1 text-[15px] font-medium tabular-nums">{day.getDate()}</span>
                <span
                  className={cn('mt-1 size-1 rounded-full', written ? 'bg-current' : 'opacity-0')}
                />
              </button>
            )
          })}
        </div>

        <form className="border-b border-border/70" onSubmit={(event) => void onCapture(event)}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write something down…"
            disabled={saving}
            className="w-full bg-transparent py-2.5 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
        </form>

        {recent.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Recent
            </h2>
            <ul className="flex flex-col gap-0.5">
              {recent.map((page) => (
                <li key={page.id}>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-accent/70"
                    onClick={() => void selectPage(page.id, space.id)}
                  >
                    <IconBadge icon={page.icon} color={page.iconColor} className="size-6" />
                    <span className="min-w-0 flex-1 truncate">{displayTitle(page.title)}</span>
                    <TypeBadge type={page.type} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Capture a line, or open a day from the week.
          </p>
        )}
      </div>
    </article>
  )
}
