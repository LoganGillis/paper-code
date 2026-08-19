import { useMemo, useState } from 'react'
import { House } from 'lucide-react'
import { ICON_ACCENT } from '@shared/icons'
import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { TypeBadge } from '@/components/type-badge'
import { dailyTitle, formatClock, sameDay, weekDays, weekdayName, weekdayShort } from '@/lib/desk'
import { collectPages } from '@/lib/pages'
import { cn } from '@/lib/utils'
import { wantsNewTab } from '@/lib/platform'
import { useNow } from '@/lib/use-now'
import { useWorkspace } from '@/lib/workspace'
import { DeskAtmosphere } from '@/components/desk-atmosphere'

export function DeskBlotter({ active = true }: { active?: boolean }): React.JSX.Element {
  const { trees, spaces, spaceId, createPage, selectPage } = useWorkspace()
  const host = spaces.find((space) => space.id === spaceId) ?? spaces[0] ?? null
  const now = useNow()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const hits = useMemo(
    () =>
      collectPages(trees).sort((a, b) =>
        (b.page.updatedAt ?? '').localeCompare(a.page.updatedAt ?? '')
      ),
    [trees]
  )
  const recent = hits.slice(0, 6)
  const days = weekDays(now)

  async function onCapture(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const title = draft.trim()
    if (!title || saving || !host) return
    setSaving(true)
    try {
      setDraft('')
      await createPage(host.id, 'markdown', title)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className="accent-select relative flex h-full min-h-0 flex-col overflow-auto select-text"
      style={{ '--page-accent': ICON_ACCENT.slate } as React.CSSProperties}
    >
      <DeskAtmosphere active={active} />
      <header className="relative z-10 mx-auto w-full max-w-3xl shrink-0 px-10 pt-10 pb-4">
        <div className="mb-3 flex items-start gap-3">
          <House className="mt-1 size-8 shrink-0 text-ink-soft" strokeWidth={1.5} />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[2.2rem] leading-[1.15] font-semibold tracking-[-0.04em]">
                {dailyTitle(now)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{weekdayName(now)}</p>
            </div>
            <p className="pt-1 text-[1.65rem] leading-none font-medium tracking-[-0.03em] tabular-nums text-foreground">
              {formatClock(now)}
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto min-h-0 w-full max-w-3xl flex-1 px-10 pr-12 pb-8">
        <div className="mb-8 grid grid-cols-7 gap-1">
          {days.map((day) => {
            const today = sameDay(day, now)
            return (
              <div
                key={dailyTitle(day)}
                className={cn(
                  'flex flex-col items-center rounded-md py-2 text-[13px]',
                  today ? 'border border-foreground/25 text-foreground' : 'text-muted-foreground'
                )}
              >
                <span className="text-[10px] font-medium tracking-[0.14em] uppercase">
                  {weekdayShort(day)}
                </span>
                <span className="mt-1 text-[15px] font-medium tabular-nums">{day.getDate()}</span>
              </div>
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
              {recent.map((hit) => (
                <li key={hit.page.id}>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-accent/70"
                    onClick={(event) =>
                      void selectPage(hit.page.id, hit.spaceId, { newTab: wantsNewTab(event) })
                    }
                  >
                    <IconBadge icon={hit.page.icon} color={hit.page.iconColor} className="size-6" />
                    <span className="min-w-0 flex-1 truncate">{displayTitle(hit.page.title)}</span>
                    <TypeBadge type={hit.page.type} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">Capture a line to start a page.</p>
        )}
      </div>
    </article>
  )
}
