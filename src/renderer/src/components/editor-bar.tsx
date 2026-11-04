import type { PageType } from '@shared/api'
import { Button } from '@/components/ui/button'
import { TypeBadge } from '@/components/type-badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

/** The bar above every editor: type badge on the left, Run and toggles on the right. */
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

/** A single-choice ShadCN ToggleGroup for editor bars (language, table/chart, view toggles). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label
}: {
  value: T
  options: ReadonlyArray<{
    id: T
    label: string
    icon?: React.ComponentType<{ className?: string }>
  }>
  onChange: (id: T) => void
  disabled?: boolean
  label?: string
}): React.JSX.Element {
  return (
    <ToggleGroup
      type="single"
      value={value}
      disabled={disabled}
      aria-label={label}
      onValueChange={(next) => {
        if (next && next !== value) onChange(next as T)
      }}
    >
      {options.map((item) => {
        const Icon = item.icon
        return (
          <ToggleGroupItem key={item.id} value={item.id}>
            {Icon ? <Icon className="size-3.5" /> : null}
            {item.label}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
