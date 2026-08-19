import { useEffect } from 'react'
import { displayTitle } from '@shared/titles'
import { PageView } from '@/components/page-view'
import { SavedFlashProvider } from '@/components/saved-flash'
import { Sidebar } from '@/components/sidebar'
import { TabBar } from '@/components/tab-bar'
import { isDeskPageId } from '@/lib/desk'
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace'

function Shell(): React.JSX.Element {
  const { ready, error, page } = useWorkspace()

  useEffect(() => {
    if (!window.api?.setTitle) return
    if (!page || isDeskPageId(page.id)) window.api.setTitle('Paper')
    else window.api.setTitle(`Paper - ${displayTitle(page.title)}`)
  }, [page])

  if (!ready) {
    return (
      <div className="flex h-full flex-col">
        <div className="app-drag h-11 shrink-0" />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Opening your desk…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="paper-page flex min-w-0 flex-1 flex-col">
        <TabBar />
        {error ? (
          <p role="alert" className="px-8 pt-6 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="min-h-0 flex-1">
          <PageView />
        </div>
      </main>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <WorkspaceProvider>
      <SavedFlashProvider>
        <Shell />
      </SavedFlashProvider>
    </WorkspaceProvider>
  )
}

export default App
