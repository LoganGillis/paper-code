import { Lock } from 'lucide-react'

/** The muted reason shown at the end of a menu item that a lock disables. */
export function LockHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="ml-auto inline-flex items-center gap-1 pl-3 text-xs font-normal text-muted-foreground">
      <Lock className="size-3" />
      {children}
    </span>
  )
}
