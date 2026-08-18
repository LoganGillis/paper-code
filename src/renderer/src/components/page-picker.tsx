import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { TypeBadge } from '@/components/type-badge'
import { cn } from '@/lib/utils'
import type { PageHit } from '@/lib/pages'

export function PagePickList({
  items,
  index,
  onPick
}: {
  items: PageHit[]
  index: number
  onPick: (item: PageHit) => void
}): React.JSX.Element {
  if (items.length === 0) {
    return <p className="px-3 py-4 text-sm text-muted-foreground">No matching pages.</p>
  }
  return (
    <div className="max-h-64 overflow-auto py-1">
      {items.map((item, itemIndex) => (
        <button
          key={item.page.id}
          type="button"
          className={cn(
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]',
            itemIndex === index ? 'bg-accent' : 'hover:bg-accent/70'
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            onPick(item)
          }}
        >
          <IconBadge icon={item.page.icon} color={item.page.iconColor} className="size-5" />
          <span className="min-w-0 flex-1 truncate">{displayTitle(item.page.title)}</span>
          <span className="text-xs text-muted-foreground">{item.spaceName}</span>
          <TypeBadge type={item.page.type} />
        </button>
      ))}
    </div>
  )
}
