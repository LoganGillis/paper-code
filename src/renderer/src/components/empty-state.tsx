import { cn } from '@/lib/utils'

/** The one "nothing here yet" message: centred, muted, optional icon and action. */
export function EmptyState({
  children,
  icon: Icon,
  action,
  size = 'sm',
  className
}: {
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
  size?: 'xs' | 'sm'
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 px-3 py-6 text-center text-muted-foreground',
        size === 'xs' ? 'text-[12px]' : 'text-sm',
        className
      )}
    >
      {Icon ? <Icon className="size-5 opacity-60" /> : null}
      <p>{children}</p>
      {action}
    </div>
  )
}
