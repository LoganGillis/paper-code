import { cn } from '@/lib/utils'

/**
 * The header every page shares: icon, optional breadcrumb above the title, actions on the
 * right and a state slot underneath (description, status). Left-aligned, never auto-centred.
 */
export function PageHeader({
  icon,
  title,
  breadcrumb,
  actions,
  state,
  wide = false,
  className
}: {
  icon: React.ReactNode
  title: React.ReactNode
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  state?: React.ReactNode
  wide?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <header
      className={cn(
        'group shrink-0',
        wide ? 'px-6 pt-6 pb-3' : 'w-full max-w-3xl px-10 pt-10 pb-4',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          {breadcrumb ? <div className="mb-1">{breadcrumb}</div> : null}
          {title}
        </div>
        {actions}
      </div>
      {state ? <div className="mt-1">{state}</div> : null}
    </header>
  )
}
