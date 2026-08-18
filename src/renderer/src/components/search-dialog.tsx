import type { FolderNode, PageSummary, SpaceTree } from '@shared/api'
import { displayTitle } from '@shared/titles'
import { IconBadge } from '@/components/icon-picker'
import { TypeBadge } from '@/components/type-badge'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { useWorkspace } from '@/lib/workspace'

type SearchHit =
  | { kind: 'page'; page: PageSummary; spaceId: string; spaceName: string }
  | {
      kind: 'folder'
      id: string
      name: string
      icon: FolderNode['icon']
      iconColor: FolderNode['iconColor']
      spaceId: string
      spaceName: string
    }
  | {
      kind: 'space'
      id: string
      name: string
      icon: SpaceTree['space']['icon']
      iconColor: SpaceTree['space']['iconColor']
    }

function collectHits(tree: SpaceTree): SearchHit[] {
  const items: SearchHit[] = [
    {
      kind: 'space',
      id: tree.space.id,
      name: tree.space.name,
      icon: tree.space.icon,
      iconColor: tree.space.iconColor
    }
  ]
  const walk = (folders: FolderNode[]): void => {
    for (const folder of folders) {
      items.push({
        kind: 'folder',
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        iconColor: folder.iconColor,
        spaceId: tree.space.id,
        spaceName: tree.space.name
      })
      for (const page of folder.pages) {
        items.push({ page, spaceId: tree.space.id, spaceName: tree.space.name, kind: 'page' })
      }
      walk(folder.folders)
    }
  }
  for (const page of tree.pages) {
    items.push({ page, spaceId: tree.space.id, spaceName: tree.space.name, kind: 'page' })
  }
  walk(tree.folders)
  return items
}

export function SearchDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { trees, selectPage, selectFolder, toggleSpace, openSpaceIds } = useWorkspace()
  const items = Object.values(trees).flatMap(collectHits)
  const pages = items.filter((item) => item.kind === 'page')
  const folders = items.filter((item) => item.kind === 'folder')
  const spaces = items.filter((item) => item.kind === 'space')

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, folders, and spaces…" />
      <CommandList>
        <CommandEmpty>No matching pages.</CommandEmpty>
        <CommandGroup heading="Pages">
          {pages.map((item) => (
            <CommandItem
              key={item.page.id}
              value={`${displayTitle(item.page.title)} ${item.spaceName} ${item.page.type} page`}
              onSelect={() => {
                void selectPage(item.page.id, item.spaceId)
                onOpenChange(false)
              }}
            >
              <IconBadge icon={item.page.icon} color={item.page.iconColor} />
              <span className="min-w-0 flex-1 truncate">{displayTitle(item.page.title)}</span>
              <span className="text-xs text-muted-foreground">{item.spaceName}</span>
              <TypeBadge type={item.page.type} />
            </CommandItem>
          ))}
        </CommandGroup>
        {folders.length > 0 ? (
          <CommandGroup heading="Folders">
            {folders.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.name} ${item.spaceName} folder`}
                onSelect={() => {
                  selectFolder(item.spaceId, item.id)
                  if (!openSpaceIds.includes(item.spaceId)) toggleSpace(item.spaceId)
                  onOpenChange(false)
                }}
              >
                <IconBadge icon={item.icon} color={item.iconColor} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.spaceName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {spaces.length > 0 ? (
          <CommandGroup heading="Spaces">
            {spaces.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.name} space`}
                onSelect={() => {
                  if (!openSpaceIds.includes(item.id)) toggleSpace(item.id)
                  else selectFolder(item.id, null)
                  onOpenChange(false)
                }}
              >
                <IconBadge icon={item.icon} color={item.iconColor} />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
