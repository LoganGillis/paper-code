import {
  Archive,
  ArchiveRestore,
  Copy,
  CopyPlus,
  KeyRound,
  MoreHorizontal,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { LockHint } from '@/components/lock-hint'
import { cn } from '@/lib/utils'

export function ItemMenu({
  onDuplicate,
  onCopy,
  onDelete,
  onArchive,
  onUnarchive,
  onRestore,
  onSecrets,
  deleteHint,
  className
}: {
  onDuplicate: () => void
  onCopy: () => void
  onDelete: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onRestore?: () => void
  onSecrets?: () => void
  /** When set, Delete is disabled and shows this reason (e.g. "Unlock to delete"). */
  deleteHint?: string
  className?: string
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100',
            className
          )}
          aria-label="Item actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {onSecrets ? (
          <>
            <DropdownMenuItem onSelect={onSecrets}>
              <KeyRound className="size-3.5" />
              Secrets
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={onDuplicate}>
          <CopyPlus className="size-3.5" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopy}>
          <Copy className="size-3.5" />
          Copy
        </DropdownMenuItem>
        {onArchive ? (
          <DropdownMenuItem onSelect={onArchive}>
            <Archive className="size-3.5" />
            Archive
          </DropdownMenuItem>
        ) : null}
        {onUnarchive ? (
          <DropdownMenuItem onSelect={onUnarchive}>
            <ArchiveRestore className="size-3.5" />
            Unarchive
          </DropdownMenuItem>
        ) : null}
        {onRestore ? (
          <DropdownMenuItem onSelect={onRestore}>
            <ArchiveRestore className="size-3.5" />
            Restore
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={Boolean(deleteHint)}
          onSelect={onDelete}
        >
          <Trash2 className="size-3.5" />
          {onRestore ? 'Delete forever' : 'Move to trash'}
          {deleteHint ? <LockHint>{deleteHint}</LockHint> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
