import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  CopyPlus,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  KeyRound,
  Plus,
  Trash2
} from 'lucide-react'
import type { IconColorId } from '@shared/icons'
import type { FolderNode, PageSummary, SpaceTree } from '@shared/api'
import { defaultPageTitle, displayTitle } from '@shared/titles'
import { TypeBadge } from '@/components/type-badge'
import { cn } from '@/lib/utils'
import { EditableLabel } from '@/components/editable-label'
import { IconBadge, IconPicker } from '@/components/icon-picker'
import { isDeskPageId } from '@/lib/desk'
import { ItemMenu } from '@/components/item-menu'
import { SecretsDialog } from '@/components/secrets-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/rpc'
import { useWorkspace } from '@/lib/workspace'

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value)
}

function PageRow({
  page,
  spaceId,
  depth
}: {
  page: PageSummary
  spaceId: string
  depth: number
}): React.JSX.Element {
  const {
    page: selected,
    selectPage,
    renamePage,
    deletePage,
    selectFolder,
    updatePageAppearance,
    duplicatePage
  } = useWorkspace()
  const active = selected?.id === page.id

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group flex h-8 items-center gap-1 rounded-md pr-1 text-[13px] transition-colors duration-150',
            active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
          )}
          style={{ paddingLeft: 10 + depth * 12 }}
        >
          <IconPicker
            icon={page.icon}
            color={page.iconColor}
            onChange={(appearance) => void updatePageAppearance(page.id, appearance)}
          />
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center text-left"
            onClick={() => {
              selectFolder(spaceId, page.folderId)
              void selectPage(page.id, spaceId)
            }}
          >
            <EditableLabel
              value={displayTitle(page.title)}
              className="min-w-0 flex-1"
              onCommit={(title) => void renamePage(page.id, title)}
            />
          </button>
          <div className="relative flex size-6 shrink-0 items-center justify-center">
            <TypeBadge
              type={page.type}
              className="pointer-events-none transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0 group-has-[[data-state=open]]:opacity-0"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-has-[[data-state=open]]:pointer-events-auto group-has-[[data-state=open]]:opacity-100">
              <ItemMenu
                className="opacity-100"
                onDuplicate={() => void duplicatePage(page.id)}
                onCopy={() => {
                  void api.pages.get({ id: page.id }).then((full) => copyText(full.content))
                }}
                onDelete={() => void deletePage(page.id)}
              />
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void duplicatePage(page.id)}>
          <CopyPlus className="size-3.5" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            void api.pages.get({ id: page.id }).then((full) => copyText(full.content))
          }}
        >
          <Copy className="size-3.5" />
          Copy
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => void deletePage(page.id)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FolderRow({
  folder,
  spaceId,
  depth
}: {
  folder: FolderNode
  spaceId: string
  depth: number
}): React.JSX.Element {
  const {
    activeFolderId,
    selectFolder,
    renameFolder,
    deleteFolder,
    updateFolderAppearance,
    duplicateFolder
  } = useWorkspace()
  const [open, setOpen] = useState(true)
  const active = activeFolderId === folder.id

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group flex h-8 items-center gap-1 rounded-md pr-1 text-[13px] transition-colors duration-150',
              active ? 'bg-accent/80' : 'hover:bg-accent/70'
            )}
            style={{ paddingLeft: 10 + depth * 12 }}
          >
            <button
              type="button"
              className="flex size-5 items-center justify-center text-muted-foreground"
              aria-label={open ? 'Collapse folder' : 'Expand folder'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            <IconPicker
              icon={folder.icon}
              color={folder.iconColor}
              onChange={(appearance) => void updateFolderAppearance(folder.id, appearance)}
            />
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center text-left"
              onClick={() => selectFolder(spaceId, folder.id)}
            >
              <EditableLabel
                value={folder.name}
                onCommit={(name) => void renameFolder(folder.id, name)}
              />
            </button>
            <div className="relative flex size-6 shrink-0 items-center justify-center">
              <Folder className="size-3.5 text-muted-foreground transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0 group-has-[[data-state=open]]:opacity-0" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-has-[[data-state=open]]:pointer-events-auto group-has-[[data-state=open]]:opacity-100">
                <ItemMenu
                  className="opacity-100"
                  onDuplicate={() => void duplicateFolder(folder.id)}
                  onCopy={() => void copyText(folder.name)}
                  onDelete={() => void deleteFolder(folder.id)}
                />
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => void duplicateFolder(folder.id)}>
            <CopyPlus className="size-3.5" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void copyText(folder.name)}>
            <Copy className="size-3.5" />
            Copy
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => void deleteFolder(folder.id)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          {folder.folders.map((child) => (
            <FolderRow key={child.id} folder={child} spaceId={spaceId} depth={depth + 1} />
          ))}
          {folder.pages.map((page) => (
            <PageRow key={page.id} page={page} spaceId={spaceId} depth={depth + 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DeskRow({ spaceId, color }: { spaceId: string; color: IconColorId }): React.JSX.Element {
  const { page, openDesk } = useWorkspace()
  const active = Boolean(page && isDeskPageId(page.id) && page.spaceId === spaceId)

  return (
    <button
      type="button"
      className={cn(
        'flex h-8 w-full items-center gap-1 rounded-md pr-1 text-[13px] transition-colors duration-150',
        active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'
      )}
      style={{ paddingLeft: 10 }}
      onClick={() => openDesk(spaceId)}
    >
      <IconBadge icon="House" color={color} className="size-6" />
      <span className="min-w-0 flex-1 truncate text-left">Desk</span>
    </button>
  )
}

export function SpaceTreeView({ tree }: { tree: SpaceTree }): React.JSX.Element {
  return (
    <div className="pb-2">
      <DeskRow spaceId={tree.space.id} color={tree.space.iconColor} />
      {tree.folders.map((folder) => (
        <FolderRow key={folder.id} folder={folder} spaceId={tree.space.id} depth={0} />
      ))}
      {tree.pages.map((page) => (
        <PageRow key={page.id} page={page} spaceId={tree.space.id} depth={0} />
      ))}
    </div>
  )
}

export function SpaceSection({ tree }: { tree: SpaceTree }): React.JSX.Element {
  const {
    openSpaceIds,
    toggleSpace,
    renameSpace,
    updateSpaceAppearance,
    duplicateSpace,
    deleteSpace,
    createPage,
    createFolder,
    importCsv
  } = useWorkspace()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [secretsOpen, setSecretsOpen] = useState(false)
  const open = openSpaceIds.includes(tree.space.id)

  return (
    <section className="px-1.5">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group flex h-9 items-center gap-1 rounded-lg px-1.5 transition-colors duration-150 hover:bg-accent/60">
            <button
              type="button"
              className="flex size-5 items-center justify-center text-muted-foreground"
              aria-label={open ? 'Collapse space' : 'Expand space'}
              onClick={() => toggleSpace(tree.space.id)}
            >
              {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            <IconPicker
              icon={tree.space.icon}
              color={tree.space.iconColor}
              onChange={(appearance) => void updateSpaceAppearance(tree.space.id, appearance)}
            />
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center text-left"
              onClick={() => toggleSpace(tree.space.id)}
            >
              <EditableLabel
                value={tree.space.name}
                className="text-[13px] font-medium"
                onCommit={(name) => void renameSpace(tree.space.id, name)}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  aria-label="New in this space"
                >
                  <Plus className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    void createPage(tree.space.id, 'markdown', defaultPageTitle('markdown'))
                  }
                >
                  <FileText className="size-3.5" />
                  New page
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    void createPage(tree.space.id, 'javascript', defaultPageTitle('javascript'))
                  }
                >
                  <FileCode2 className="size-3.5" />
                  New JavaScript
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    void createPage(tree.space.id, 'typescript', defaultPageTitle('typescript'))
                  }
                >
                  <FileCode2 className="size-3.5" />
                  New TypeScript
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void createPage(tree.space.id, 'csv', defaultPageTitle('csv'))}
                >
                  <FileSpreadsheet className="size-3.5" />
                  New CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void importCsv(tree.space.id)}>
                  <FileSpreadsheet className="size-3.5" />
                  Open CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void createFolder(tree.space.id, 'Untitled folder')}
                >
                  <FolderPlus className="size-3.5" />
                  New folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ItemMenu
              onSecrets={() => setSecretsOpen(true)}
              onDuplicate={() => void duplicateSpace(tree.space.id)}
              onCopy={() => void copyText(tree.space.name)}
              onDelete={() => setConfirmDelete(true)}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onSelect={() =>
              void createPage(tree.space.id, 'markdown', defaultPageTitle('markdown'))
            }
          >
            <FileText className="size-3.5" />
            New page
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              void createPage(tree.space.id, 'javascript', defaultPageTitle('javascript'))
            }
          >
            <FileCode2 className="size-3.5" />
            New JavaScript
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              void createPage(tree.space.id, 'typescript', defaultPageTitle('typescript'))
            }
          >
            <FileCode2 className="size-3.5" />
            New TypeScript
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => void createPage(tree.space.id, 'csv', defaultPageTitle('csv'))}
          >
            <FileSpreadsheet className="size-3.5" />
            New CSV
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void createFolder(tree.space.id, 'Untitled folder')}>
            <FolderPlus className="size-3.5" />
            New folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setSecretsOpen(true)}>
            <KeyRound className="size-3.5" />
            Secrets
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void duplicateSpace(tree.space.id)}>
            <CopyPlus className="size-3.5" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void copyText(tree.space.name)}>
            <Copy className="size-3.5" />
            Copy
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <SpaceTreeView tree={tree} />
        </div>
      </div>

      <SecretsDialog space={tree.space} open={secretsOpen} onOpenChange={setSecretsOpen} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this space?</DialogTitle>
            <DialogDescription>
              {tree.space.name} and every folder and page inside it will be removed. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false)
                void deleteSpace(tree.space.id)
              }}
            >
              Delete space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
