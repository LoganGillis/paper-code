import { useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Lock, Plus, ShieldAlert } from 'lucide-react'
import { ICON_ACCENT } from '@shared/icons'
import type { SecretSummary, Space } from '@shared/api'
import { MIN_REDACT_LENGTH } from '@shared/redact'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/lib/confirm'
import { api } from '@/lib/rpc'
import { RUN_ACCENT } from '@/lib/run-accent'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { EmptyState } from '@/components/empty-state'

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
        className="pr-16 font-mono"
      />
      <Button
        type="button"
        variant="ghost"
        className="absolute top-1/2 right-1 h-7 -translate-y-1/2 px-2 text-[11px] text-muted-foreground"
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? 'Hide' : 'Show'}
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
  const [selection, setSelection] = useState<string>('new')
  const [keyName, setKeyName] = useState('')
  const [value, setValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const selected = secrets.find((secret) => secret.id === selection) ?? null

  useEffect(() => {
    if (!open) {
      setKeyName('')
      setValue('')
      setReplaceValue('')
      setError(null)
      setCopied(false)
      setSelection('new')
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
        setSelection((current) =>
          current !== 'new' && items.some((item) => item.id === current)
            ? current
            : (items[0]?.id ?? 'new')
        )
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load secrets')
      })
  }, [open, space.id])

  function startNew(): void {
    setSelection('new')
    setKeyName('')
    setValue('')
    setReplaceValue('')
    setError(null)
  }

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
      setSelection(created.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save secret')
    } finally {
      setBusy(false)
    }
  }

  async function onReplace(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!selected || !replaceValue || busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.secrets.update({ id: selected.id, value: replaceValue })
      setSecrets((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setReplaceValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not replace secret')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(): Promise<void> {
    if (!selected || busy) return
    const ok = await confirm({
      title: `Delete ${selected.key}?`,
      description: 'Scripts using this secret will fail. This cannot be undone.',
      confirmLabel: 'Delete secret'
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const id = selected.id
      await api.secrets.delete({ id })
      const remaining = secrets.filter((item) => item.id !== id)
      setSecrets(remaining)
      setSelection(remaining[0]?.id ?? 'new')
      setReplaceValue('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete secret')
    } finally {
      setBusy(false)
    }
  }

  async function copyCall(key: string): Promise<void> {
    await navigator.clipboard.writeText(`$secret("${key}")`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(46rem,calc(100vw-2rem))] accent-select"
        style={{ '--page-accent': ICON_ACCENT[space.iconColor] } as React.CSSProperties}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <IconBadge
              icon={space.icon}
              color={space.iconColor}
              variant="plain"
              className="size-10"
            />
            <div className="min-w-0">
              <DialogTitle>Secrets</DialogTitle>
              <DialogDescription className="truncate">
                {space.name}
                {sealed ? ' · sealed in the system keychain' : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {sealed ? null : (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3 py-2.5 text-[13px] leading-5 text-destructive">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <p>
              This computer cannot seal secrets. Unlock the OS keychain — Paper will not store API
              keys in plaintext.
            </p>
          </div>
        )}

        <div className="mt-4 grid h-[26rem] grid-cols-[15rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/70">
          <div className="flex min-h-0 flex-col bg-sidebar/50">
            <div className="flex items-center justify-between px-2 py-2">
              <p className="px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                {secrets.length === 1 ? '1 key' : `${secrets.length} keys`}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2"
                disabled={!sealed}
                onClick={startNew}
              >
                <Plus className="size-3.5" />
                New
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-0.5 px-2 pb-2">
                {secrets.length === 0 ? (
                  <EmptyState size="xs">No keys in this space yet.</EmptyState>
                ) : (
                  secrets.map((secret) => {
                    const active = secret.id === selection
                    return (
                      <button
                        key={secret.id}
                        type="button"
                        className={cn(
                          'flex h-9 items-center gap-2 rounded-md px-2 text-left text-[13px]',
                          active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
                        )}
                        onClick={() => {
                          setSelection(secret.id)
                          setReplaceValue('')
                          setError(null)
                          setCopied(false)
                        }}
                      >
                        <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-mono">{secret.key}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-h-0 flex-col bg-paper/40 p-4">
            {selection === 'new' || !selected ? (
              <form className="flex flex-col gap-3" onSubmit={(event) => void onAdd(event)}>
                <div>
                  <p className="text-sm font-medium">New secret</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                    Name it the way a script will ask for it. The value is sealed and is not shown
                    again.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`secret-name-${space.id}`}>Name</Label>
                  <Input
                    id={`secret-name-${space.id}`}
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                    placeholder="API_KEY"
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="font-mono"
                    disabled={!sealed}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={`secret-value-${space.id}`}>Value</Label>
                  <SecretValueField
                    id={`secret-value-${space.id}`}
                    value={value}
                    onChange={setValue}
                    placeholder="Paste the key"
                    disabled={!sealed}
                  />
                  <p className="text-xs text-muted-foreground">
                    Output hides every match of a value {MIN_REDACT_LENGTH}+ characters long, so a
                    short value like &quot;abc&quot; is hidden wherever it appears.
                  </p>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className={cn('shadow-none', RUN_ACCENT[space.iconColor])}
                    disabled={!sealed || busy || !keyName.trim() || !value}
                  >
                    Save secret
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-base">{selected.key}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <Lock className="size-3" style={{ color: 'var(--page-accent)' }} />
                      Sealed · updated {formatUpdated(selected.updatedAt)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-3 flex w-fit items-center gap-2 rounded-md bg-sidebar px-2.5 py-1.5 font-mono text-[12px] text-foreground"
                  onClick={() => void copyCall(selected.key)}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {`$secret("${selected.key}")`}
                </button>
                <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                  Scripts in this space read the sealed value with that call. Paper does not show
                  the saved key.
                </p>

                <form className="mt-5 grid gap-1.5" onSubmit={(event) => void onReplace(event)}>
                  <Label htmlFor={`replace-${selected.id}`}>Replace value</Label>
                  <SecretValueField
                    id={`replace-${selected.id}`}
                    value={replaceValue}
                    onChange={setReplaceValue}
                    placeholder="Paste a new value"
                    disabled={!sealed}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      className={cn('h-8 shadow-none', RUN_ACCENT[space.iconColor])}
                      disabled={!sealed || busy || !replaceValue}
                    >
                      Save new value
                    </Button>
                  </div>
                </form>

                {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

                <div className="mt-auto border-t border-border/70 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground hover:text-destructive"
                    disabled={busy}
                    onClick={() => void onDelete()}
                  >
                    Delete secret
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-start justify-between gap-3 rounded-xl bg-sidebar/80 px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor={`expose-secrets-${space.id}`}>Share with other spaces</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Off by default. When on, a script in another space can read these keys with $secret.
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
