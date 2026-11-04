import { cva } from 'class-variance-authority'

export const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-sm text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-[color,box-shadow] outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-paper data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      size: {
        default: 'h-6 px-2',
        sm: 'h-5 px-1.5'
      }
    },
    defaultVariants: { size: 'default' }
  }
)
