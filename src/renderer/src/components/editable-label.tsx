import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type EditableLabelProps = {
  value: string
  className?: string
  onCommit: (value: string) => void
}

export function EditableLabel({
  value,
  className,
  onCommit
}: EditableLabelProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  if (!editing) {
    return (
      <span
        className={cn('min-w-0 truncate', className)}
        onDoubleClick={(event) => {
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
        'min-w-0 flex-1 rounded-sm bg-paper px-1 text-inherit outline-none ring-1 ring-ring',
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
