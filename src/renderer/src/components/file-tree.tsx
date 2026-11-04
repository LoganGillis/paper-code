import { useState } from 'react'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Copy,
  CopyPlus,
  Folder,
  KeyRound,
  Plus,
  Columns2,
  SquareArrowOutUpRight,
  Trash2
} from 'lucide-react'
import type { FolderNode, PageSummary, SpaceTree } from '@shared/api'
import { defaultPageTitle, displayTitle } from '@shared/titles'
import { TypeBadge } from '@/components/type-badge'
import { cn } from '@/lib/utils'
import { EditableLabel } from '@/components/editable-label'
import { IconBadge, IconPicker } from '@/components/icon-picker'
import { ItemMenu } from '@/components/item-menu'
import { NewMenuItems } from '@/components/new-menu-items'
import { useConfirm } from '@/lib/confirm'
import { LockHint } from '@/components/lock-hint'
import { firstLockedPage } from '@/lib/tree-locks'
import { lockHint } from '@shared/locks'
import { SecretsDialog } from '@/components/secrets-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/rpc'
import { wantsNewTab } from '@/lib/platform'
import { useWorkspace } from '@/lib/workspace'
import { EmptyState } from '@/components/empty-state'

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
    archivePage,
    unarchivePage,
    selectFolder,
    updatePageAppearance,
    duplicatePage,
    openBeside,
    movePage,
    restorePage,
    purgePage,
    showTrash,
    runningPageIds
  } = useWorkspace()
  const confirm = useConfirm()
  const purge = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Delete this page forever?',
      description: `${displayTitle(page.title)} will be removed for good. This cannot be undone.`,
      confirmLabel: 'Delete forever'
    })
    if (ok) await purgePage(page.id)
  }
  const active = selected?.id === page.id
  const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable={!page.locked}
          title={page.locked ? lockHint('move') : undefined}
          onDragStart={(event) => {
            event.dataTransfer.setData(
              'application/x-paper',
              JSON.stringify({ kind: 'page', id: page.id, spaceId })
            )
            event.dataTransfer.effectAllowed = 'move'
            const ghost = event.currentTarget.cloneNode(true) as HTMLElement
            ghost.style.position = 'absolute'
            ghost.style.top = '-9999px'
            ghost.style.width = `${event.currentTarget.offsetWidth}px`
            ghost.style.opacity = '0.92'
            ghost.style.background = 'var(--paper)'
            document.body.appendChild(ghost)
            event.dataTransfer.setDragImage(ghost, 16, 16)
            requestAnimationFrame(() => ghost.remove())
            event.currentTarget.classList.add('opacity-40')
          }}
          onDragEnd={(event) => {
            event.currentTarget.classList.remove('opacity-40')
            setDropEdge(null)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            const rect = event.currentTarget.getBoundingClientRect()
            setDropEdge(event.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
          }}
          onDragLeave={() => setDropEdge(null)}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const edge = dropEdge
            setDropEdge(null)
            try {
              const payload = JSON.parse(event.dataTransfer.getData('application/x-paper')) as {
                kind: string
                id: string
              }
              if (payload.kind === 'page' && payload.id !== page.id) {
                void movePage({
                  id: payload.id,
                  folderId: page.folderId,
                  beforeId: edge === 'after' ? null : page.id
                })
              }
            } catch {
              // ignore
            }
          }}
          className={cn(
            'group relative flex h-9 items-center gap-1 rounded-md pr-1 text-[13px] transition-colors duration-150',
            page.locked && 'select-none',
            active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70',
            dropEdge === 'before' &&
              'before:absolute before:inset-x-2 before:top-0 before:h-0.5 before:bg-foreground/50 before:content-[""]',
            dropEdge === 'after' &&
              'after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-foreground/50 after:content-[""]'
          )}
          style={{ paddingLeft: 10 + depth * 12 }}
        >
          {runningPageIds.includes(page.id) ? (
            <span className="inline-flex size-6 items-center justify-center">
              <Spinner className="size-3.5" />
            </span>
          ) : page.locked ? (
            <span title={lockHint('change')}>
              <IconBadge icon={page.icon} color={page.iconColor} className="size-6" />
            </span>
          ) : (
            <IconPicker
              icon={page.icon}
              color={page.iconColor}
              onChange={(appearance) => void updatePageAppearance(page.id, appearance)}
            />
          )}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center text-left"
            onClick={(event) => {
              selectFolder(spaceId, page.folderId)
              void selectPage(page.id, spaceId, { newTab: wantsNewTab(event) })
            }}
            onAuxClick={(event) => {
              if (event.button !== 1) return
              event.preventDefault()
              event.stopPropagation()
              selectFolder(spaceId, page.folderId)
              void selectPage(page.id, spaceId, { newTab: true })
            }}
          >
            <EditableLabel
              value={displayTitle(page.title)}
              className="min-w-0 flex-1"
              disabled={page.locked}
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
                onArchive={
                  page.archived || page.deletedAt ? undefined : () => void archivePage(page.id)
                }
                onUnarchive={
                  page.archived && !page.deletedAt ? () => void unarchivePage(page.id) : undefined
                }
                onRestore={page.deletedAt ? () => void restorePage(page.id) : undefined}
                onDelete={() => (showTrash ? void purge() : void deletePage(page.id))}
                deleteHint={page.locked ? lockHint(showTrash ? 'purge' : 'delete') : undefined}
                archiveHint={
                  page.locked ? lockHint(page.archived ? 'unarchive' : 'archive') : undefined
                }
              />
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            selectFolder(spaceId, page.folderId)
            void selectPage(page.id, spaceId, { newTab: true })
          }}
        >
          <SquareArrowOutUpRight className="size-3.5" />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            void openBeside(page.id, spaceId)
          }}
        >
          <Columns2 className="size-3.5" />
          Open beside
        </ContextMenuItem>
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
        {page.deletedAt ? (
          <ContextMenuItem onSelect={() => void restorePage(page.id)}>Restore</ContextMenuItem>
        ) : page.archived ? (
          <ContextMenuItem disabled={page.locked} onSelect={() => void unarchivePage(page.id)}>
            Unarchive
            {page.locked ? <LockHint>{lockHint('unarchive')}</LockHint> : null}
          </ContextMenuItem>
        ) : (
          <ContextMenuItem disabled={page.locked} onSelect={() => void archivePage(page.id)}>
            Archive
            {page.locked ? <LockHint>{lockHint('archive')}</LockHint> : null}
          </ContextMenuItem>
        )}
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          disabled={page.locked}
          onSelect={() => (showTrash ? void purge() : void deletePage(page.id))}
        >
          <Trash2 className="size-3.5" />
          {showTrash ? 'Delete forever' : 'Move to trash'}
          {page.locked ? <LockHint>{lockHint(showTrash ? 'purge' : 'delete')}</LockHint> : null}
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
    duplicateFolder,
    moveFolder,
    movePage,
    createPage,
    createFolder,
    importCsv,
    pasteJsonFromClipboard
  } = useWorkspace()
  const confirm = useConfirm()
  const lockedInside = firstLockedPage(folder)
  const into = { folderId: folder.id }
  const removeFolder = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Move this folder to the trash?',
      description: `${folder.name} and every page inside it will move to the trash.`,
      confirmLabel: 'Move to trash'
    })
    if (ok) await deleteFolder(folder.id)
  }
  const [open, setOpen] = useState(true)
  const active = activeFolderId === folder.id

  return (
    <div className={cn('flex flex-col', open && 'gap-1')}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            draggable={!lockedInside}
            title={lockedInside ? lockHint('move') : undefined}
            onDragStart={(event) => {
              event.dataTransfer.setData(
                'application/x-paper',
                JSON.stringify({ kind: 'folder', id: folder.id, spaceId })
              )
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              try {
                const payload = JSON.parse(event.dataTransfer.getData('application/x-paper')) as {
                  kind: string
                  id: string
                }
                if (payload.kind === 'page') {
                  void movePage({ id: payload.id, folderId: folder.id, beforeId: null })
                }
                if (payload.kind === 'folder' && payload.id !== folder.id) {
                  void moveFolder({ id: payload.id, parentId: folder.id, beforeId: null })
                }
              } catch {
                // ignore
              }
            }}
            className={cn(
              'group flex h-9 items-center gap-1 rounded-md pr-1 text-[13px] transition-colors duration-150',
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
              variant="plain"
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
                  onDelete={() => void removeFolder()}
                  deleteHint={lockedInside ? lockHint('delete') : undefined}
                />
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Plus className="size-3.5" />
              New
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <NewMenuItems
                menu="context"
                onCreate={(type) =>
                  void createPage(spaceId, type, defaultPageTitle(type), undefined, into)
                }
                onPasteJson={() => void pasteJsonFromClipboard(spaceId, into)}
                onOpenFile={() => void importCsv(spaceId, into)}
                onNewFolder={() => void createFolder(spaceId, 'Untitled folder', folder.id)}
              />
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
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
            disabled={Boolean(lockedInside)}
            onSelect={() => void removeFolder()}
          >
            <Trash2 className="size-3.5" />
            Move to trash
            {lockedInside ? <LockHint>{lockHint('delete')}</LockHint> : null}
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
          <div className="flex flex-col gap-1">
            {folder.folders.map((child) => (
              <FolderRow key={child.id} folder={child} spaceId={spaceId} depth={depth + 1} />
            ))}
            {folder.pages.map((page) => (
              <PageRow key={page.id} page={page} spaceId={spaceId} depth={depth + 1} />
            ))}
            {folder.folders.length === 0 && folder.pages.length === 0 ? (
              <EmptyState
                size="xs"
                className="items-start py-1.5 text-left"
                style={{ paddingLeft: 10 + (depth + 1) * 12 + 8 }}
              >
                Empty folder
              </EmptyState>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SpaceTreeView({ tree }: { tree: SpaceTree }): React.JSX.Element {
  const { showArchived, showTrash } = useWorkspace()
  const archived = tree.archivedPages ?? []
  const trashed = tree.trashedPages ?? []

  if (showTrash) {
    return (
      <div className="flex min-h-[8rem] flex-col gap-1 pb-2">
        {trashed.length === 0 ? (
          <EmptyState size="xs" icon={Trash2}>
            Nothing in the trash.
          </EmptyState>
        ) : (
          trashed.map((page) => (
            <PageRow key={page.id} page={page} spaceId={tree.space.id} depth={0} />
          ))
        )}
      </div>
    )
  }

  if (showArchived) {
    return (
      <div className="flex min-h-[8rem] flex-col gap-1 pb-2">
        {archived.length === 0 ? (
          <EmptyState size="xs" icon={Archive}>
            Nothing archived here.
          </EmptyState>
        ) : (
          archived.map((page) => (
            <PageRow key={page.id} page={page} spaceId={tree.space.id} depth={0} />
          ))
        )}
      </div>
    )
  }

  const empty = tree.folders.length === 0 && tree.pages.length === 0
  return (
    <div className="flex min-h-[8rem] flex-col gap-1 pb-2">
      {empty ? (
        <EmptyState size="xs">Create a page to get started.</EmptyState>
      ) : (
        <>
          {tree.folders.map((folder) => (
            <FolderRow key={folder.id} folder={folder} spaceId={tree.space.id} depth={0} />
          ))}
          {tree.pages.map((page) => (
            <PageRow key={page.id} page={page} spaceId={tree.space.id} depth={0} />
          ))}
        </>
      )}
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
    importCsv,
    pasteJsonFromClipboard,
    exportSpace,
    importSpace,
    movePage,
    moveFolder
  } = useWorkspace()
  const confirm = useConfirm()
  const removeSpace = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Delete this space?',
      description: `${tree.space.name} and every folder and page inside it will be removed. This cannot be undone.`,
      confirmLabel: 'Delete space'
    })
    if (ok) await deleteSpace(tree.space.id)
  }
  const [secretsOpen, setSecretsOpen] = useState(false)
  const open = openSpaceIds.includes(tree.space.id)

  return (
    <section className="flex flex-col gap-1 px-1.5">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group flex h-10 items-center gap-1 rounded-lg px-1.5 transition-colors duration-150 hover:bg-accent/60">
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
              variant="plain"
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
                <NewMenuItems
                  menu="dropdown"
                  onCreate={(type) => void createPage(tree.space.id, type, defaultPageTitle(type))}
                  onPasteJson={() => void pasteJsonFromClipboard(tree.space.id)}
                  onOpenFile={() => void importCsv(tree.space.id)}
                  onNewFolder={() => void createFolder(tree.space.id, 'Untitled folder')}
                />
              </DropdownMenuContent>
            </DropdownMenu>
            <ItemMenu
              onSecrets={() => setSecretsOpen(true)}
              onDuplicate={() => void duplicateSpace(tree.space.id)}
              onCopy={() => void copyText(tree.space.name)}
              onDelete={() => void removeSpace()}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <NewMenuItems
            menu="context"
            onCreate={(type) => void createPage(tree.space.id, type, defaultPageTitle(type))}
            onPasteJson={() => void pasteJsonFromClipboard(tree.space.id)}
            onOpenFile={() => void importCsv(tree.space.id)}
            onNewFolder={() => void createFolder(tree.space.id, 'Untitled folder')}
          />
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setSecretsOpen(true)}>
            <KeyRound className="size-3.5" />
            Secrets
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void exportSpace(tree.space.id)}>
            Export space
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void importSpace()}>Import space</ContextMenuItem>
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
            onSelect={() => void removeSpace()}
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
        <div
          className="overflow-hidden"
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
          }}
          onDrop={(event) => {
            event.preventDefault()
            try {
              const payload = JSON.parse(event.dataTransfer.getData('application/x-paper')) as {
                kind: string
                id: string
              }
              if (payload.kind === 'page') {
                void movePage({ id: payload.id, folderId: null, beforeId: null })
              }
              if (payload.kind === 'folder') {
                void moveFolder({ id: payload.id, parentId: null, beforeId: null })
              }
            } catch {
              // ignore
            }
          }}
        >
          <SpaceTreeView tree={tree} />
        </div>
      </div>

      <SecretsDialog space={tree.space} open={secretsOpen} onOpenChange={setSecretsOpen} />
    </section>
  )
}
