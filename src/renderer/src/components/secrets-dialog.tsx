import { useEffect, useState } from 'react'
import { Eye, EyeOff, Lock, ShieldAlert, Trash2 } from 'lucide-react'
import { ICON_ACCENT } from '@shared/icons'
import type { SecretSummary, Space } from '@shared/api'
import { IconBadge } from '@/components/icon-picker'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/rpc'
import { RUN_ACCENT } from '@/lib/run-accent'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function SecretValueField({
  id,
  value,
  onChange,
  placeholder,
  disabled
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        disabled={disabled}
        className="pr-9 font-mono"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2 text-muted-foreground"
        aria-label={visible ? 'Hide value' : 'Show value'}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </Button>
    </div>
  )
}

export function SecretsDialog({
  space,
  open,
  onOpenChange
}: {
  space: Space
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { setSpaceSecretsExposed } = useWorkspace()
  const [secrets, setSecrets] = useState<SecretSummary[]>([])
  const [sealed, setSealed] = useState(true)
  const [keyName, setKeyName] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [replaceValue, setReplaceValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setKeyName('')
      setValue('')
      setError(null)
      setReplacingId(null)
      setReplaceValue('')
      setPendingDelete(null)
      return
    }
    setError(null)
    void Promise.all([
      api.secrets.list({ spaceId: space.id }),
      api.secrets.encryptionAvailable().catch(() => true)
    ])
      .then(([items, available]) => {
        setSecrets(items)
        setSealed(available)
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load secrets')
      })
  }, [open, space.id])

  async function onAdd(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const name = keyName.trim()
    if (!name || !value || busy) return
    setBusy(true)
    setError(null)
    try {
      const created = await api.secrets.create({ spaceId: space.id, key: name, value })
      setSecrets((current) => [...current, created].sort((a, b) => a.key.localeCompare(b.key)))
      setKeyName('')
      setValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save secret')
    } finally {
      setBusy(false)
    }
  }

  async function onReplace(id: string): Promise<void> {
    if (!replaceValue || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.secrets.update({ id, value: replaceValue })
      setSecrets((current) => current.map((item) => (item.id === id ? updated : item)))
      setReplacingId(null)
      setReplaceValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not replace secret')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.secrets.delete({ id })
      setSecrets((current) => current.filter((item) => item.id !== id))
      setPendingDelete(null)
      if (replacingId === id) {
        setReplacingId(null)
        setReplaceValue('')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete secret')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(30rem,calc(100vw-2rem))] accent-select"
        style={{ '--page-accent': ICON_ACCENT[space.iconColor] } as React.CSSProperties}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <IconBadge icon={space.icon} color={space.iconColor} variant="plain" className="size-10" />
            <div className="min-w-0">
              <DialogTitle>Secrets</DialogTitle>
              <DialogDescription className="truncate">{space.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          className={cn(
            'mt-5 flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[13px] leading-5',
            sealed ? 'text-foreground' : 'bg-destructive/10 text-destructive'
          )}
          style={
            sealed
              ? {
                  background: 'color-mix(in oklab, var(--page-accent) 12%, transparent)'
                }
              : undefined
          }
        >
          {sealed ? (
            <Lock className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--page-accent)' }} />
          ) : (
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          )}
          <p>
            {sealed
              ? 'Values are sealed with the operating system keychain. Paper never shows a saved key, and scripts read them with $secret("NAME").'
              : 'This computer cannot seal secrets. Unlock the OS keychain — Paper will not store API keys in plaintext.'}
          </p>
        </div>

        <ul className="mt-4 flex flex-col gap-1.5">
          {secrets.length === 0 ? (
            <li className="rounded-xl bg-sidebar/80 px-3 py-3 text-sm text-muted-foreground">
              No secrets in this space yet.
            </li>
          ) : (
            secrets.map((secret) => {
              const replacing = replacingId === secret.id
              const confirming = pendingDelete === secret.id
              return (
                <li
                  key={secret.id}
                  className="rounded-xl bg-sidebar/80 px-3 py-2"
                  style={{
                    boxShadow: replacing
                      ? `inset 0 0 0 1px color-mix(in oklab, var(--page-accent) 35%, transparent)`
                      : undefined
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[13px]">{secret.key}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Updated {formatUpdated(secret.updatedAt)}
                      </p>
                    </div>
                    {confirming ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-7"
                          disabled={busy}
                          onClick={() => void onDelete(secret.id)}
                        >
                          Delete
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          onClick={() => setPendingDelete(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7"
                          disabled={!sealed}
                          onClick={() => {
                            setPendingDelete(null)
                            setReplacingId(secret.id)
                            setReplaceValue('')
                          }}
                        >
                          Replace
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${secret.key}`}
                          onClick={() => {
                            setReplacingId(null)
                            setReplaceValue('')
                            setPendingDelete(secret.id)
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  {replacing ? (
                    <form
                      className="mt-2 flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void onReplace(secret.id)
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <SecretValueField
                          value={replaceValue}
                          onChange={setReplaceValue}
                          placeholder="New value — the old one is never shown"
                        />
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        className={cn('h-8 shadow-none', RUN_ACCENT[space.iconColor])}
                        disabled={busy || !replaceValue}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => {
                          setReplacingId(null)
                          setReplaceValue('')
                        }}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>

        <form className="mt-4 grid gap-2" onSubmit={(event) => void onAdd(event)}>
          <Label
            htmlFor={`secret-name-${space.id}`}
            className="text-[11px] tracking-wide uppercase"
          >
            New secret
          </Label>
          <Input
            id={`secret-name-${space.id}`}
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
            placeholder="API_KEY"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="font-mono"
            disabled={!sealed}
          />
          <SecretValueField
            value={value}
            onChange={setValue}
            placeholder="Paste the key — it will not be shown again"
            disabled={!sealed}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            className={cn('shadow-none', RUN_ACCENT[space.iconColor])}
            disabled={!sealed || busy || !keyName.trim() || !value}
          >
            Add secret
          </Button>
        </form>

        <div className="mt-5 flex items-start justify-between gap-3 rounded-xl bg-sidebar/80 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor={`expose-secrets-${space.id}`}>Expose to other spaces</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Off by default. When on, scripts in other spaces can read these values with $secret.
            </p>
          </div>
          <Switch
            id={`expose-secrets-${space.id}`}
            className="data-[state=checked]:bg-[var(--page-accent)]"
            checked={space.secretsExposed}
            onCheckedChange={(checked) => {
              void setSpaceSecretsExposed(space.id, checked)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
