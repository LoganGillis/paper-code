import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { IconColorId, IconName } from '@shared/icons'
import type { Page, PageType, Space, SpaceTree, TabRef } from '@shared/api'
import { api } from '@/lib/rpc'
import { buildDeskPage, dailyDoc, dailyTitle, isDeskPageId, spaceIdFromDesk } from '@/lib/desk'
import { GUIDE_PAGE_ID, buildGuidePage, isGuidePageId } from '@/lib/guide'
import { collectPages } from '@/lib/pages'

const SPACE_KEY = 'paper.spaceId'
const PAGE_KEY = 'paper.activePageId'
const TABS_KEY = 'paper.tabs'
const OPEN_SPACES_KEY = 'paper.openSpaces'

type WorkspaceContextValue = {
  ready: boolean
  error: string | null
  spaces: Space[]
  trees: Record<string, SpaceTree>
  spaceId: string | null
  page: Page | null
  pagesById: Record<string, Page>
  tabs: TabRef[]
  openSpaceIds: string[]
  activeFolderId: string | null
  selectSpace: (id: string) => void
  toggleSpace: (id: string) => void
  selectPage: (id: string, spaceId: string) => Promise<void>
  openGuide: () => void
  openDesk: (spaceId: string) => void
  openDaily: (spaceId: string, date?: Date) => Promise<void>
  preserveEditorFocus: boolean
  closeTab: (pageId: string) => void
  selectFolder: (spaceId: string, folderId: string | null) => void
  createSpace: (name: string) => Promise<void>
  createFolder: (spaceId: string, name: string) => Promise<void>
  createPage: (spaceId: string, type: PageType, title: string, content?: string) => Promise<void>
  importCsv: (spaceId: string) => Promise<void>
  duplicateSpace: (id: string) => Promise<void>
  duplicateFolder: (id: string) => Promise<void>
  duplicatePage: (id: string) => Promise<void>
  renameSpace: (id: string, name: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  renamePage: (id: string, title: string) => Promise<void>
  savePageContent: (id: string, content: string) => Promise<void>
  savePageDescription: (id: string, description: string) => Promise<void>
  updateSpaceAppearance: (
    id: string,
    appearance: { icon: IconName; iconColor: IconColorId }
  ) => Promise<void>
  setSpaceSecretsExposed: (id: string, exposed: boolean) => Promise<void>
  updateFolderAppearance: (
    id: string,
    appearance: { icon: IconName; iconColor: IconColorId }
  ) => Promise<void>
  updatePageAppearance: (
    id: string,
    appearance: { icon: IconName; iconColor: IconColorId }
  ) => Promise<void>
  runningPageIds: string[]
  setPageRunning: (id: string, running: boolean) => void
  deleteSpace: (id: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  deletePage: (id: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [trees, setTrees] = useState<Record<string, SpaceTree>>({})
  const [spaceId, setSpaceId] = useState<string | null>(null)
  const [page, setPage] = useState<Page | null>(null)
  const [pagesById, setPagesById] = useState<Record<string, Page>>({})
  const pagesByIdRef = useRef(pagesById)
  const [tabs, setTabs] = useState<TabRef[]>([])
  const [openSpaceIds, setOpenSpaceIds] = useState<string[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [runningPageIds, setRunningPageIds] = useState<string[]>([])
  const [preserveEditorFocus, setPreserveEditorFocus] = useState(false)
  const selectPageRef = useRef<(id: string, spaceId: string) => Promise<void>>(
    async () => undefined
  )
  const booted = useRef(false)

  const setPageRunning = useCallback((id: string, running: boolean) => {
    setRunningPageIds((current) => {
      if (running) return current.includes(id) ? current : [...current, id]
      return current.filter((item) => item !== id)
    })
  }, [])

  const storePage = useCallback((next: Page) => {
    setPagesById((current) => {
      const updated = { ...current, [next.id]: next }
      pagesByIdRef.current = updated
      return updated
    })
  }, [])

  const patchPage = useCallback((id: string, patch: Partial<Page>) => {
    setPagesById((current) => {
      const prev = current[id]
      if (!prev) return current
      const updated = { ...current, [id]: { ...prev, ...patch } }
      pagesByIdRef.current = updated
      return updated
    })
    setPage((current) => (current?.id === id ? { ...current, ...patch } : current))
  }, [])

  const dropPages = useCallback((ids: string[]) => {
    setPagesById((current) => {
      const next = { ...current }
      for (const id of ids) delete next[id]
      pagesByIdRef.current = next
      return next
    })
  }, [])

  const refreshTree = useCallback(async (id: string): Promise<SpaceTree> => {
    const next = await api.spaces.getTree({ id })
    setTrees((current) => ({ ...current, [id]: next }))
    return next
  }, [])

  const refreshSpaces = useCallback(async () => {
    const list = await api.spaces.list()
    setSpaces(list)
    const loaded = await Promise.all(list.map((space) => api.spaces.getTree({ id: space.id })))
    const nextTrees: Record<string, SpaceTree> = {}
    for (const tree of loaded) nextTrees[tree.space.id] = tree
    setTrees(nextTrees)
    return { list, trees: nextTrees }
  }, [])

  const isLockedPageId = (id: string): boolean => isGuidePageId(id) || isDeskPageId(id)

  const openDesk = useCallback(
    (hostSpace: string) => {
      const space = spaces.find((item) => item.id === hostSpace)
      if (!space) return
      const desk = buildDeskPage(space)
      storePage(desk)
      setPage(desk)
      setSpaceId(space.id)
      setActiveFolderId(null)
      window.localStorage.setItem(PAGE_KEY, desk.id)
      window.localStorage.setItem(SPACE_KEY, space.id)
      setTabs((current) => {
        const exists = current.some((tab) => tab.pageId === desk.id)
        const nextTabs = exists ? current : [...current, { pageId: desk.id, spaceId: space.id }]
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        return nextTabs
      })
      setOpenSpaceIds((current) => {
        const nextOpen = current.includes(space.id) ? current : [...current, space.id]
        window.localStorage.setItem(OPEN_SPACES_KEY, JSON.stringify(nextOpen))
        return nextOpen
      })
    },
    [spaces, storePage]
  )

  const openGuide = useCallback(() => {
    const hostSpace = spaceId ?? spaces[0]?.id
    if (!hostSpace) return
    const guide = buildGuidePage(hostSpace, trees)
    storePage(guide)
    setPage(guide)
    window.localStorage.setItem(PAGE_KEY, GUIDE_PAGE_ID)
    setTabs((current) => {
      const exists = current.some((tab) => tab.pageId === GUIDE_PAGE_ID)
      const nextTabs = exists
        ? current
        : [...current, { pageId: GUIDE_PAGE_ID, spaceId: hostSpace }]
      window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
      return nextTabs
    })
  }, [spaceId, spaces, storePage, trees])

  const selectPage = useCallback(
    async (id: string, nextSpaceId: string) => {
      const active = document.activeElement
      setPreserveEditorFocus(
        Boolean(
          active?.closest('.cm-editor') ||
          active?.closest('.tiptap') ||
          (active instanceof HTMLInputElement && active.getAttribute('aria-label') === 'Page title')
        )
      )
      if (isGuidePageId(id)) {
        const hostSpace =
          nextSpaceId && !isGuidePageId(nextSpaceId) && !isDeskPageId(nextSpaceId)
            ? nextSpaceId
            : (spaceId ?? spaces[0]?.id)
        if (hostSpace) {
          const guide = buildGuidePage(hostSpace, trees)
          storePage(guide)
          setPage(guide)
          window.localStorage.setItem(PAGE_KEY, GUIDE_PAGE_ID)
          setTabs((current) => {
            const exists = current.some((tab) => tab.pageId === GUIDE_PAGE_ID)
            const nextTabs = exists
              ? current
              : [...current, { pageId: GUIDE_PAGE_ID, spaceId: hostSpace }]
            window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
            return nextTabs
          })
        }
        return
      }
      if (isDeskPageId(id)) {
        openDesk(spaceIdFromDesk(id) ?? nextSpaceId)
        return
      }
      const cached = pagesByIdRef.current[id]
      if (cached) {
        setPage(cached)
        setActiveFolderId(cached.folderId)
      }
      setSpaceId(nextSpaceId)
      window.localStorage.setItem(PAGE_KEY, id)
      window.localStorage.setItem(SPACE_KEY, nextSpaceId)
      setTabs((current) => {
        const exists = current.some((tab) => tab.pageId === id)
        const nextTabs = exists ? current : [...current, { pageId: id, spaceId: nextSpaceId }]
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        return nextTabs
      })
      setOpenSpaceIds((current) => {
        const nextOpen = current.includes(nextSpaceId) ? current : [...current, nextSpaceId]
        window.localStorage.setItem(OPEN_SPACES_KEY, JSON.stringify(nextOpen))
        return nextOpen
      })
      if (cached) return
      const next = await api.pages.get({ id })
      storePage(next)
      setPage(next)
      setActiveFolderId(next.folderId)
    },
    [openDesk, spaceId, spaces, storePage, trees]
  )

  useEffect(() => {
    selectPageRef.current = selectPage
  }, [selectPage])

  const openDaily = useCallback(
    async (hostSpace: string, date = new Date()) => {
      const space = spaces.find((item) => item.id === hostSpace)
      if (!space) return
      const title = dailyTitle(date)
      let tree = trees[hostSpace]
      if (!tree) tree = await refreshTree(hostSpace)
      const existing = collectPages({ [hostSpace]: tree }).find((hit) => hit.page.title === title)
      if (existing) {
        await selectPage(existing.page.id, hostSpace)
        return
      }
      const journal =
        tree.folders.find((folder) => folder.name === 'Journal') ??
        (await (async () => {
          const created = await api.folders.create({ spaceId: hostSpace, name: 'Journal' })
          await api.folders.update({
            id: created.id,
            icon: 'Calendar',
            iconColor: space.iconColor
          })
          return created
        })())
      const created = await api.pages.create({
        spaceId: hostSpace,
        folderId: journal.id,
        type: 'markdown',
        title,
        content: JSON.stringify(dailyDoc(date))
      })
      await refreshTree(hostSpace)
      await selectPage(created.id, hostSpace)
    },
    [refreshTree, selectPage, spaces, trees]
  )

  const closeTab = useCallback(
    (pageId: string) => {
      setTabs((current) => {
        const nextTabs = current.filter((tab) => tab.pageId !== pageId)
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        dropPages([pageId])
        if (page?.id === pageId) {
          const fallback = nextTabs.at(-1)
          if (fallback) void selectPage(fallback.pageId, fallback.spaceId)
          else {
            setPage(null)
            window.localStorage.removeItem(PAGE_KEY)
          }
        }
        return nextTabs
      })
    },
    [dropPages, page?.id, selectPage]
  )

  const selectSpace = useCallback((id: string) => {
    setSpaceId(id)
    window.localStorage.setItem(SPACE_KEY, id)
    setOpenSpaceIds((current) => {
      const nextOpen = current.includes(id) ? current : [...current, id]
      window.localStorage.setItem(OPEN_SPACES_KEY, JSON.stringify(nextOpen))
      return nextOpen
    })
  }, [])

  const toggleSpace = useCallback((id: string) => {
    setOpenSpaceIds((current) => {
      const nextOpen = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
      window.localStorage.setItem(OPEN_SPACES_KEY, JSON.stringify(nextOpen))
      return nextOpen
    })
    setSpaceId(id)
    window.localStorage.setItem(SPACE_KEY, id)
  }, [])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void (async () => {
      try {
        const { list } = await refreshSpaces()
        const storedOpen = window.localStorage.getItem(OPEN_SPACES_KEY)
        const storedTabs = window.localStorage.getItem(TABS_KEY)
        const storedPage = window.localStorage.getItem(PAGE_KEY)
        const storedSpace = window.localStorage.getItem(SPACE_KEY)

        let parsedTabs: TabRef[] = []
        try {
          parsedTabs = storedTabs ? (JSON.parse(storedTabs) as TabRef[]) : []
        } catch {
          parsedTabs = []
        }
        const validTabs = parsedTabs.filter(
          (tab) => isGuidePageId(tab.pageId) || list.some((space) => space.id === tab.spaceId)
        )
        setTabs(validTabs)

        let parsedOpen: string[] = []
        try {
          parsedOpen = storedOpen ? (JSON.parse(storedOpen) as string[]) : []
        } catch {
          parsedOpen = []
        }
        const validOpen =
          parsedOpen.filter((id) => list.some((space) => space.id === id)).length > 0
            ? parsedOpen.filter((id) => list.some((space) => space.id === id))
            : list[0]
              ? [list[0].id]
              : []
        setOpenSpaceIds(validOpen)

        const preferredSpace =
          storedSpace && list.some((space) => space.id === storedSpace)
            ? storedSpace
            : (list[0]?.id ?? null)
        if (preferredSpace) setSpaceId(preferredSpace)

        const preferredPage =
          storedPage && validTabs.some((tab) => tab.pageId === storedPage)
            ? validTabs.find((tab) => tab.pageId === storedPage)
            : validTabs[0]
        if (preferredPage) {
          await selectPageRef.current(preferredPage.pageId, preferredPage.spaceId)
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load workspace')
      } finally {
        setReady(true)
      }
    })()
  }, [refreshSpaces])

  const selectFolder = useCallback((nextSpaceId: string, folderId: string | null) => {
    setSpaceId(nextSpaceId)
    setActiveFolderId(folderId)
    window.localStorage.setItem(SPACE_KEY, nextSpaceId)
  }, [])

  const createSpace = useCallback(
    async (name: string) => {
      const space = await api.spaces.create({ name })
      await refreshSpaces()
      setOpenSpaceIds((current) => [...current, space.id])
      setSpaceId(space.id)
    },
    [refreshSpaces]
  )

  const createFolder = useCallback(
    async (nextSpaceId: string, name: string) => {
      const folder = await api.folders.create({
        spaceId: nextSpaceId,
        parentId: spaceId === nextSpaceId ? activeFolderId : null,
        name
      })
      setActiveFolderId(folder.id)
      setSpaceId(nextSpaceId)
      await refreshTree(nextSpaceId)
    },
    [activeFolderId, refreshTree, spaceId]
  )

  const createPage = useCallback(
    async (nextSpaceId: string, type: PageType, title: string, content?: string) => {
      const created = await api.pages.create({
        spaceId: nextSpaceId,
        folderId: spaceId === nextSpaceId ? activeFolderId : null,
        type,
        title,
        content
      })
      await refreshTree(nextSpaceId)
      await selectPage(created.id, nextSpaceId)
    },
    [activeFolderId, refreshTree, selectPage, spaceId]
  )

  const importCsv = useCallback(
    async (nextSpaceId: string) => {
      const picked = await api.app.pickCsv()
      if (!picked) return
      await createPage(nextSpaceId, 'csv', picked.name, picked.content)
    },
    [createPage]
  )

  const duplicateSpace = useCallback(
    async (id: string) => {
      const copy = await api.spaces.duplicate({ id })
      await refreshSpaces()
      setOpenSpaceIds((current) => [...current, copy.id])
      setSpaceId(copy.id)
    },
    [refreshSpaces]
  )

  const duplicateFolder = useCallback(
    async (id: string) => {
      const copy = await api.folders.duplicate({ id })
      const parentSpace =
        Object.values(trees).find((tree) => JSON.stringify(tree).includes(`"id":"${copy.id}"`))
          ?.space.id ?? spaceId
      if (parentSpace) {
        await refreshTree(parentSpace)
        setActiveFolderId(copy.id)
      }
    },
    [refreshTree, spaceId, trees]
  )

  const duplicatePage = useCallback(
    async (id: string) => {
      const copy = await api.pages.duplicate({ id })
      await refreshTree(copy.spaceId)
      await selectPage(copy.id, copy.spaceId)
    },
    [refreshTree, selectPage]
  )

  const renameSpace = useCallback(
    async (id: string, name: string) => {
      await api.spaces.update({ id, name })
      await refreshSpaces()
    },
    [refreshSpaces]
  )

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      const folderSpace =
        Object.values(trees).find((tree) => JSON.stringify(tree).includes(`"id":"${id}"`))?.space
          .id ?? spaceId
      await api.folders.update({ id, name })
      if (folderSpace) await refreshTree(folderSpace)
    },
    [refreshTree, spaceId, trees]
  )

  const renamePage = useCallback(
    async (id: string, title: string) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, title })
      storePage(updated)
      setPage((current) => (current?.id === id ? updated : current))
      await refreshTree(updated.spaceId)
    },
    [refreshTree, storePage]
  )

  const savePageContent = useCallback(
    async (id: string, content: string) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, content })
      patchPage(id, { content: updated.content })
    },
    [patchPage]
  )

  const savePageDescription = useCallback(
    async (id: string, description: string) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, description })
      patchPage(id, { description: updated.description })
    },
    [patchPage]
  )

  const updateSpaceAppearance = useCallback(
    async (id: string, appearance: { icon: IconName; iconColor: IconColorId }) => {
      await api.spaces.update({ id, ...appearance })
      await refreshSpaces()
    },
    [refreshSpaces]
  )

  const setSpaceSecretsExposed = useCallback(
    async (id: string, exposed: boolean) => {
      await api.spaces.update({ id, secretsExposed: exposed })
      await refreshSpaces()
    },
    [refreshSpaces]
  )

  const updateFolderAppearance = useCallback(
    async (id: string, appearance: { icon: IconName; iconColor: IconColorId }) => {
      await api.folders.update({ id, ...appearance })
      if (spaceId) await refreshTree(spaceId)
    },
    [refreshTree, spaceId]
  )

  const updatePageAppearance = useCallback(
    async (id: string, appearance: { icon: IconName; iconColor: IconColorId }) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, ...appearance })
      storePage(updated)
      setPage((current) => (current?.id === id ? updated : current))
      await refreshTree(updated.spaceId)
    },
    [refreshTree, storePage]
  )

  const deleteSpace = useCallback(
    async (id: string) => {
      await api.spaces.delete({ id })
      setTabs((current) => {
        const removed = current.filter((tab) => tab.spaceId === id).map((tab) => tab.pageId)
        dropPages(removed)
        return current.filter((tab) => tab.spaceId !== id)
      })
      if (page?.spaceId === id) {
        setPage(null)
      }
      const { list } = await refreshSpaces()
      if (list[0] && spaceId === id) setSpaceId(list[0].id)
      if (!list[0]) {
        setSpaceId(null)
        setPage(null)
      }
    },
    [dropPages, page?.spaceId, refreshSpaces, spaceId]
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      await api.folders.delete({ id })
      if (activeFolderId === id) setActiveFolderId(null)
      if (spaceId) await refreshTree(spaceId)
    },
    [activeFolderId, refreshTree, spaceId]
  )

  const deletePage = useCallback(
    async (id: string) => {
      const spaceForPage = page?.id === id ? page.spaceId : spaceId
      await api.pages.delete({ id })
      dropPages([id])
      setTabs((current) => {
        const nextTabs = current.filter((tab) => tab.pageId !== id)
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        return nextTabs
      })
      if (page?.id === id) {
        setPage(null)
        window.localStorage.removeItem(PAGE_KEY)
      }
      if (spaceForPage) await refreshTree(spaceForPage)
    },
    [dropPages, page, refreshTree, spaceId]
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ready,
      error,
      spaces,
      trees,
      spaceId,
      page,
      pagesById,
      tabs,
      openSpaceIds,
      activeFolderId,
      selectSpace,
      toggleSpace,
      selectPage,
      openGuide,
      openDesk,
      openDaily,
      closeTab,
      selectFolder,
      createSpace,
      createFolder,
      createPage,
      importCsv,
      duplicateSpace,
      duplicateFolder,
      duplicatePage,
      renameSpace,
      renameFolder,
      renamePage,
      savePageContent,
      savePageDescription,
      updateSpaceAppearance,
      setSpaceSecretsExposed,
      updateFolderAppearance,
      updatePageAppearance,
      deleteSpace,
      deleteFolder,
      deletePage,
      runningPageIds,
      setPageRunning,
      preserveEditorFocus
    }),
    [
      activeFolderId,
      closeTab,
      createFolder,
      createPage,
      createSpace,
      deleteFolder,
      deletePage,
      deleteSpace,
      duplicateFolder,
      duplicatePage,
      duplicateSpace,
      error,
      importCsv,
      openDaily,
      openDesk,
      openGuide,
      openSpaceIds,
      page,
      pagesById,
      preserveEditorFocus,
      ready,
      renameFolder,
      renamePage,
      renameSpace,
      savePageContent,
      savePageDescription,
      selectFolder,
      selectPage,
      selectSpace,
      spaceId,
      spaces,
      tabs,
      toggleSpace,
      trees,
      updateFolderAppearance,
      updatePageAppearance,
      updateSpaceAppearance,
      setSpaceSecretsExposed,
      runningPageIds,
      setPageRunning
    ]
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider')
  }
  return context
}
