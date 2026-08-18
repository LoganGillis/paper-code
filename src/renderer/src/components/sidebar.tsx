import { useEffect, useState } from 'react'
import { Archive, BookOpen, Plus, Search, Settings } from 'lucide-react'
import { SpaceSection } from '@/components/file-tree'
import { SearchDialog } from '@/components/search-dialog'
import { SettingsDialog } from '@/components/settings-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isMac, modSymbol } from '@/lib/platform'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'

export function Sidebar(): React.JSX.Element {
  const { spaces, trees, createSpace, openGuide, showArchived, setShowArchived } = useWorkspace()
  const [newSpaceName, setNewSpaceName] = useState('')
  const [spaceOpen, setSpaceOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <aside className="sidebar-rail z-10 flex h-full w-[272px] shrink-0 flex-col bg-sidebar">
      <div
        className={cn(
          'app-drag flex h-11 shrink-0 items-center gap-1 px-2',
          isMac() && 'pl-[92px]'
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="app-no-drag h-7 flex-1 justify-start gap-2 px-2 text-muted-foreground"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" />
          <span className="text-[13px]">Search</span>
          <KbdGroup className="ml-auto">
            <Kbd>{modSymbol()}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="app-no-drag size-7"
          aria-label="Create space"
          onClick={() => setSpaceOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 py-1">
          {spaces.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Create a space to begin.</p>
          ) : (
            spaces.map((space) =>
              trees[space.id] ? <SpaceSection key={space.id} tree={trees[space.id]} /> : null
            )
          )}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between px-2 py-2">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Guide"
            onClick={() => openGuide()}
          >
            <BookOpen />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-8', showArchived && 'bg-accent text-accent-foreground')}
            aria-label={showArchived ? 'Hide archive' : 'Show archive'}
            aria-pressed={showArchived}
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings />
        </Button>
      </div>

      <Dialog
        open={spaceOpen}
        onOpenChange={(open) => {
          setSpaceOpen(open)
          if (!open) setNewSpaceName('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New space</DialogTitle>
            <DialogDescription>
              A space holds folders, pages, and its own secrets.
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const name = newSpaceName.trim()
              if (!name) return
              void createSpace(name)
              setNewSpaceName('')
              setSpaceOpen(false)
            }}
          >
            <Input
              autoFocus
              value={newSpaceName}
              onChange={(event) => setNewSpaceName(event.target.value)}
              placeholder="Workshop"
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSpaceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newSpaceName.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  )
}
