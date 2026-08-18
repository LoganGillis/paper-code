import { useMemo, useState } from 'react'
import type { IconColorId, IconName } from '@shared/icons'
import { ICON_ACCENT, ICON_COLOR_IDS, ICON_NAMES } from '@shared/icons'
import { NamedIcon } from '@/lib/lucide-icons'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'

const COLOR_LABELS: Record<IconColorId, string> = {
  slate: 'Slate',
  rose: 'Rose',
  peach: 'Peach',
  amber: 'Amber',
  sage: 'Sage',
  mint: 'Mint',
  sky: 'Sky',
  indigo: 'Indigo',
  lilac: 'Lilac',
  blush: 'Blush'
}

export function IconBadge({
  icon,
  color,
  className,
  variant = 'chip'
}: {
  icon: IconName
  color: IconColorId
  className?: string
  variant?: 'chip' | 'plain'
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center',
        variant === 'chip' && `rounded-md icon-chip icon-chip-${color}`,
        variant === 'plain' && 'bg-transparent',
        className
      )}
      style={variant === 'plain' ? { color: ICON_ACCENT[color] } : undefined}
    >
      <NamedIcon name={icon} className={variant === 'plain' ? 'size-4' : 'size-3.5'} />
    </span>
  )
}

export function IconPicker({
  icon,
  color,
  onChange,
  size = 'sm',
  variant = 'chip'
}: {
  icon: IconName
  color: IconColorId
  onChange: (next: { icon: IconName; iconColor: IconColorId }) => void
  size?: 'sm' | 'lg'
  variant?: 'chip' | 'plain'
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return ICON_NAMES
    return ICON_NAMES.filter((name) => name.toLowerCase().includes(needle))
  }, [query])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-md outline-none ring-offset-background focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Change icon"
          onClick={(event) => event.stopPropagation()}
        >
          <IconBadge
            icon={icon}
            color={color}
            variant={variant}
            className={size === 'lg' ? 'size-9' : 'size-6'}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        onClick={(event) => event.stopPropagation()}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <p className="mb-2 text-xs font-medium text-muted-foreground">Color</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ICON_COLOR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              title={COLOR_LABELS[id]}
              aria-label={COLOR_LABELS[id]}
              className={cn(
                'size-6 rounded-full icon-chip',
                `icon-chip-${id}`,
                color === id && 'ring-2 ring-ring ring-offset-2 ring-offset-popover'
              )}
              onClick={() => onChange({ icon, iconColor: id })}
            />
          ))}
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons"
          className="mb-2 h-8"
        />
        <ScrollArea className="h-48">
          <div className="grid grid-cols-7 gap-1 pr-2">
            {matches.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md text-foreground hover:bg-accent',
                  icon === name && 'bg-accent'
                )}
                onClick={() => onChange({ icon: name, iconColor: color })}
              >
                <NamedIcon name={name} className="size-4" />
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
