import { Play } from 'lucide-react'
import type { IconColorId } from '@shared/icons'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Spinner } from '@/components/ui/spinner'
import { modSymbol } from '@/lib/platform'
import { RUN_ACCENT } from '@/lib/run-accent'
import { cn } from '@/lib/utils'

/** The one Run button: accent colour, spinner while running, optional ⌘↵ hint. */
export function RunButton({
  accent,
  running,
  disabled,
  shortcut = false,
  className,
  onRun
}: {
  accent: IconColorId
  running: boolean
  disabled?: boolean
  shortcut?: boolean
  className?: string
  onRun: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      className={cn('h-7 shadow-none', RUN_ACCENT[accent], className)}
      disabled={running || disabled}
      onClick={onRun}
    >
      {running ? <Spinner className="size-3.5" /> : <Play />}
      {running ? 'Running' : 'Run'}
      {shortcut ? (
        <KbdGroup className="ml-1 opacity-80">
          <Kbd className="bg-current/15 text-current">{modSymbol()}</Kbd>
          <Kbd className="bg-current/15 text-current">↵</Kbd>
        </KbdGroup>
      ) : null}
    </Button>
  )
}
