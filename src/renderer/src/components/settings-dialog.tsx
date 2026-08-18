import { Check } from 'lucide-react'
import { useTheme, type ThemePreference } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

const THEME_OPTIONS: Array<{ id: ThemePreference; label: string; hint: string }> = [
  { id: 'system', label: 'System', hint: 'Follow the computer' },
  { id: 'light', label: 'Light', hint: 'Paper in daylight' },
  { id: 'dark', label: 'Dark', hint: 'Warm evening ink' }
]

export function SettingsDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { preference, setPreference } = useTheme()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>How Paper looks on this computer.</DialogDescription>
        </DialogHeader>

        <section className="mt-5">
          <h3 className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Appearance
          </h3>
          <div className="grid gap-1.5">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="ghost"
                className="h-auto justify-between px-3 py-2 text-left"
                onClick={() => setPreference(option.id)}
              >
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
                {preference === option.id ? <Check className="size-4" /> : null}
              </Button>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
