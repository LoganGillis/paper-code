import { PageView } from '@/components/page-view'
import { Sidebar } from '@/components/sidebar'
import { TabBar } from '@/components/tab-bar'
import { WorkspaceProvider, useWorkspace } from '@/lib/workspace'

function Shell(): React.JSX.Element {
  const { ready, error } = useWorkspace()

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
      <Shell />
    </WorkspaceProvider>
  )
}

export default App
