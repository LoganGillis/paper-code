import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { UpdateStatus } from '@shared/api'
import { useTheme, type ThemePreference } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { api } from '@/lib/rpc'
import { useWorkspace } from '@/lib/workspace'

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
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const { exportBackup, importBackup } = useWorkspace()

  useEffect(() => {
    if (!open) return
    void api.app.getUpdateStatus().then(setUpdate)
    const off = window.api?.onUpdateStatus?.((status) => setUpdate(status))
    return () => off?.()
  }, [open])

  const updateHint = ((): string => {
    if (!update) return 'Checking…'
    if (update.state === 'checking') return 'Checking for updates…'
    if (update.state === 'downloading') {
      return `Downloading ${update.availableVersion ?? ''} (${Math.round(update.percent ?? 0)}%)`
    }
    if (update.state === 'available') return `Version ${update.availableVersion} is available.`
    if (update.state === 'ready') return `Version ${update.availableVersion} is ready to install.`
    if (update.state === 'error') return update.error ?? 'Could not check for updates.'
    if (update.state === 'not-available') return 'You’re on the latest version.'
    return `Version ${update.currentVersion}`
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(28rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Paper {update?.currentVersion ?? ''}</DialogDescription>
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

        <section className="mt-6">
          <h3 className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Data
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            A full backup includes every space, folder, page, archive, trash item, and history. It
            does <span className="text-foreground">not</span> include secret values.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void exportBackup()}>
              Export everything
            </Button>
            <Button type="button" variant="secondary" onClick={() => void importBackup()}>
              Import backup
            </Button>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Updates
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">{updateHint}</p>
          {update?.state === 'ready' ? (
            <Button type="button" onClick={() => void api.app.quitAndInstall()}>
              Restart to update
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={update?.state === 'checking' || update?.state === 'downloading'}
              onClick={() => void api.app.checkForUpdates().then(setUpdate)}
            >
              Check for updates
            </Button>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
