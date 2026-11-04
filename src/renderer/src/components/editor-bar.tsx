import type { PageType } from '@shared/api'
import { Button } from '@/components/ui/button'
import { TypeBadge } from '@/components/type-badge'
import { cn } from '@/lib/utils'

export function EditorBar({
  type,
  children,
  className
}: {
  type: PageType
  children?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2',
        className
      )}
    >
      <TypeBadge type={type} className="text-[11px] font-normal" />
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function EditorBarButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>): React.JSX.Element {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn('h-6 gap-1 rounded-sm px-2 text-[11px] [&_svg]:size-3.5', className)}
      {...props}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled
}: {
  value: T
  options: ReadonlyArray<{
    id: T
    label: string
    icon?: React.ComponentType<{ className?: string }>
  }>
  onChange: (id: T) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div className="flex rounded-md bg-sidebar p-0.5">
      {options.map((item) => {
        const Icon = item.icon
        const selected = value === item.id
        return (
          <EditorBarButton
            key={item.id}
            disabled={disabled}
            className={cn(selected && 'bg-paper text-foreground shadow-sm')}
            onClick={() => {
              if (selected) return
              onChange(item.id)
            }}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            {item.label}
          </EditorBarButton>
        )
      })}
    </div>
  )
}
