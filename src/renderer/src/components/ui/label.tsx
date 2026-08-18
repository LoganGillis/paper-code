import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: ComponentProps<'label'>): React.JSX.Element {
  return (
    <label
      data-slot="label"
      className={cn(
        'text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
}

export { Label }
