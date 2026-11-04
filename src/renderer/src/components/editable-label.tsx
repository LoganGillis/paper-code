import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type EditableLabelProps = {
  value: string
  className?: string
  /** When true, double-click does not start a rename (for example on a locked page). */
  disabled?: boolean
  onCommit: (value: string) => void
}

export function EditableLabel({
  value,
  className,
  disabled = false,
  onCommit
}: EditableLabelProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  if (!editing || disabled) {
    return (
      <span
        className={cn('min-w-0 truncate', className)}
        onDoubleClick={(event) => {
          if (disabled) return
          event.stopPropagation()
          setEditing(true)
        }}
      >
        {value}
      </span>
    )
  }

  return (
    <input
      autoFocus
      value={draft}
      className={cn(
        'min-w-0 flex-1 bg-transparent p-0 text-inherit outline-none placeholder:text-muted-foreground/70',
        className
      )}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim()
        setEditing(false)
        if (next && next !== value) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
        if (event.key === 'Escape') {
          setDraft(value)
          setEditing(false)
        }
      }}
    />
  )
}
