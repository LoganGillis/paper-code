import type { PageType } from '@shared/api'
import { pageTypeLabel } from '@shared/titles'
import { cn } from '@/lib/utils'

export function TypeBadge({
  type,
  className
}: {
  type: PageType
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-[9px] font-medium tracking-wide text-muted-foreground uppercase',
        className
      )}
    >
      {pageTypeLabel(type)}
    </span>
  )
}
