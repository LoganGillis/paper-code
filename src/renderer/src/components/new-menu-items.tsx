import { ClipboardPaste, FolderOpen, FolderPlus } from 'lucide-react'
import type { PageType } from '@shared/api'
import { PAGE_TYPES } from '@shared/page-types'
import { ContextMenuItem } from '@/components/ui/context-menu'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { NamedIcon } from '@/lib/lucide-icons'
import { newMenuEntries, type NewMenuAction } from '@/lib/new-menu'

/** The items of a "New" menu, built from PAGE_TYPES, for a dropdown or a context menu. */
export function NewMenuItems({
  menu,
  onCreate,
  onPasteJson,
  onOpenFile,
  onNewFolder
}: {
  menu: 'dropdown' | 'context'
  onCreate: (type: PageType) => void
  onPasteJson: () => void
  onOpenFile: () => void
  onNewFolder?: () => void
}): React.JSX.Element {
  const Item = menu === 'dropdown' ? DropdownMenuItem : ContextMenuItem
  const run = (action: NewMenuAction): void => {
    if (action.kind === 'create') onCreate(action.type)
    else if (action.kind === 'paste-json') onPasteJson()
    else if (action.kind === 'open-file') onOpenFile()
    else onNewFolder?.()
  }
  return (
    <>
      {newMenuEntries({ withFolder: onNewFolder != null }).map((entry) => (
        <Item key={entry.key} onSelect={() => run(entry.action)}>
          {entry.action.kind === 'create' ? (
            <NamedIcon name={PAGE_TYPES[entry.action.type].icon} className="size-3.5" />
          ) : entry.action.kind === 'paste-json' ? (
            <ClipboardPaste className="size-3.5" />
          ) : entry.action.kind === 'open-file' ? (
            <FolderOpen className="size-3.5" />
          ) : (
            <FolderPlus className="size-3.5" />
          )}
          {entry.label}
        </Item>
      ))}
    </>
  )
}
