import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { IconColorId, IconName } from '@shared/icons'
import type { Page, PageType, Space, SpaceTree, TabRef } from '@shared/api'
import { api } from '@/lib/rpc'
import { DESK_PAGE_ID, buildDeskPage, isDeskPageId } from '@/lib/desk'
import { GUIDE_PAGE_ID, buildGuidePage, isGuidePageId } from '@/lib/guide'
import { buildGuideDataPages, isGuideDataPageId } from '@shared/guide-data'
import { collectPages } from '@/lib/pages'
import {
  blockText,
  buildBlockPage,
  findRunBlock,
  isBlockPageId,
  parseBlockPageId,
  writeRunBlock
} from '@/lib/run-block'

export type SelectPageOptions = { newTab?: boolean }

const SPACE_KEY = 'paper.spaceId'
const PAGE_KEY = 'paper.activePageId'
const TABS_KEY = 'paper.tabs'
const OPEN_SPACES_KEY = 'paper.openSpaces'
const BESIDE_KEY = 'paper.beside'

function pinDesk(tabs: TabRef[], hostSpace: string): TabRef[] {
  const rest = tabs.filter((tab) => !isDeskPageId(tab.pageId))
  return [{ pageId: DESK_PAGE_ID, spaceId: hostSpace }, ...rest]
}

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
  selectPage: (id: string, spaceId: string, options?: SelectPageOptions) => Promise<void>
  openGuide: () => void
  openDesk: () => void
  openRunBlock: (input: {
    pageId: string
    spaceId: string
    blockId: string
    language: 'javascript' | 'typescript'
    source: string
    newTab?: boolean
  }) => void
  saveBlockContent: (
    parentId: string,
    blockId: string,
    patch: { source?: string; language?: 'javascript' | 'typescript' }
  ) => Promise<void>
  preserveEditorFocus: boolean
  closeTab: (pageId: string) => void
  beside: TabRef | null
  paneFocus: 'main' | 'beside'
  setPaneFocus: (focus: 'main' | 'beside') => void
  openBeside: (id: string, spaceId: string) => Promise<void>
  closeBeside: () => void
  exportSpace: (id: string) => Promise<void>
  importSpace: () => Promise<void>
  movePage: (input: {
    id: string
    folderId?: string | null
    beforeId?: string | null
  }) => Promise<void>
  moveFolder: (input: {
    id: string
    parentId?: string | null
    beforeId?: string | null
  }) => Promise<void>
  showArchived: boolean
  setShowArchived: (value: boolean) => void
  showTrash: boolean
  setShowTrash: (value: boolean) => void
  archivePage: (id: string) => Promise<void>
  unarchivePage: (id: string) => Promise<void>
  restorePage: (id: string) => Promise<void>
  purgePage: (id: string) => Promise<void>
  pinnedTabIds: string[]
  togglePinTab: (pageId: string) => void
  exportBackup: () => Promise<void>
  importBackup: () => Promise<void>
  flushSave: (id: string) => Promise<void>
  updatePageFlags: (
    id: string,
    flags: { locked?: boolean; spellcheck?: boolean }
  ) => Promise<void>
  restorePageVersion: (id: string, versionId: string) => Promise<void>
  changePageType: (id: string, type: PageType) => Promise<void>
  selectFolder: (spaceId: string, folderId: string | null) => void
  createSpace: (name: string) => Promise<void>
  createFolder: (spaceId: string, name: string) => Promise<void>
  createPage: (
    spaceId: string,
    type: PageType,
    title: string,
    content?: string,
    options?: SelectPageOptions
  ) => Promise<void>
  importCsv: (spaceId: string, options?: SelectPageOptions) => Promise<void>
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
  const [showArchived, setShowArchived] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [pinnedTabIds, setPinnedTabIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem('paper.pinnedTabs')
      return stored ? (JSON.parse(stored) as string[]) : []
    } catch {
      return []
    }
  })
  const [beside, setBeside] = useState<TabRef | null>(null)
  const [paneFocus, setPaneFocus] = useState<'main' | 'beside'>('main')
  const selectPageRef = useRef<
    (id: string, spaceId: string, options?: SelectPageOptions) => Promise<void>
  >(async () => undefined)
  const pageRef = useRef<Page | null>(null)
  const booted = useRef(false)

  useEffect(() => {
    pageRef.current = page
  }, [page])

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

  const isLockedPageId = (id: string): boolean =>
    isGuidePageId(id) || isDeskPageId(id) || isGuideDataPageId(id) || isBlockPageId(id)

  const openDesk = useCallback(() => {
    const host = spaceId ?? spaces[0]?.id ?? ''
    const desk = buildDeskPage(host)
    storePage(desk)
    setPage(desk)
    setActiveFolderId(null)
    window.localStorage.setItem(PAGE_KEY, DESK_PAGE_ID)
    setTabs((current) => {
      const nextTabs = pinDesk(current, host)
      window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
      return nextTabs
    })
  }, [spaceId, spaces, storePage])

  const rememberGuideData = useCallback(
    (hostSpace: string) => {
      for (const extra of buildGuideDataPages(hostSpace)) storePage(extra)
    },
    [storePage]
  )

  const openGuide = useCallback(() => {
    const hostSpace = spaceId ?? spaces[0]?.id
    if (!hostSpace) return
    void selectPageRef.current(GUIDE_PAGE_ID, hostSpace, { newTab: true })
  }, [spaceId, spaces])

  const openRunBlock = useCallback(
    (input: {
      pageId: string
      spaceId: string
      blockId: string
      language: 'javascript' | 'typescript'
      source: string
      newTab?: boolean
    }) => {
      const parent = pagesByIdRef.current[input.pageId]
      const host: Page = parent ?? {
        id: input.pageId,
        spaceId: input.spaceId,
        folderId: null,
        title: 'Untitled',
        type: 'markdown',
        content: '',
        description: '',
        icon: 'FileText',
        iconColor: 'slate',
        sortOrder: 0,
        archived: false,
        deletedAt: null,
        locked: false,
        spellcheck: false,
        createdAt: '',
        updatedAt: ''
      }
      const virtual = buildBlockPage(host, input.blockId, input.language, input.source)
      storePage(virtual)
      void selectPageRef.current(virtual.id, input.spaceId, { newTab: input.newTab })
    },
    [storePage]
  )

  const saveBlockContent = useCallback(
    async (
      parentId: string,
      blockId: string,
      patch: { source?: string; language?: 'javascript' | 'typescript' }
    ) => {
      if (isLockedPageId(parentId)) return
      const parent =
        pagesByIdRef.current[parentId] ?? (await api.pages.get({ id: parentId }).catch(() => null))
      if (!parent) return
      const nextContent = writeRunBlock(parent.content, blockId, patch)
      if (!nextContent) return
      const updated = await api.pages.update({ id: parentId, content: nextContent })
      storePage(updated)
      const block = findRunBlock(updated.content, blockId)
      if (block) {
        const language = block.attrs?.language === 'typescript' ? 'typescript' : 'javascript'
        storePage(buildBlockPage(updated, blockId, language, blockText(block)))
      }
    },
    [storePage]
  )

  const placeTab = useCallback(
    (current: TabRef[], id: string, nextSpaceId: string, newTab: boolean): TabRef[] => {
      if (isDeskPageId(id)) return pinDesk(current, nextSpaceId)
      if (current.some((tab) => tab.pageId === id)) return pinDesk(current, nextSpaceId)
      const activeId = pageRef.current?.id
      const canReplace = Boolean(
        activeId &&
          !isDeskPageId(activeId) &&
          !newTab &&
          !pinnedTabIds.includes(activeId)
      )
      let next: TabRef[]
      if (canReplace && activeId) {
        next = current.map((tab) =>
          tab.pageId === activeId ? { pageId: id, spaceId: nextSpaceId } : tab
        )
        if (!next.some((tab) => tab.pageId === id)) {
          next = [...next, { pageId: id, spaceId: nextSpaceId }]
        }
        if (activeId !== id) dropPages([activeId])
      } else {
        next = [...current, { pageId: id, spaceId: nextSpaceId }]
      }
      return pinDesk(next, nextSpaceId)
    },
    [dropPages, pinnedTabIds]
  )

  const selectPage = useCallback(
    async (id: string, nextSpaceId: string, options?: SelectPageOptions) => {
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
          rememberGuideData(hostSpace)
          setPage(guide)
          window.localStorage.setItem(PAGE_KEY, GUIDE_PAGE_ID)
          setTabs((current) => {
            const nextTabs = placeTab(current, GUIDE_PAGE_ID, hostSpace, Boolean(options?.newTab))
            window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
            return nextTabs
          })
        }
        return
      }
      if (isDeskPageId(id)) {
        openDesk()
        return
      }
      if (isBlockPageId(id)) {
        const ref = parseBlockPageId(id)
        if (!ref) return
        const parent =
          pagesByIdRef.current[ref.pageId] ??
          (await api.pages.get({ id: ref.pageId }).catch(() => null))
        if (!parent) return
        storePage(parent)
        const fromDoc = findRunBlock(parent.content, ref.blockId)
        const existing = pagesByIdRef.current[id]
        const next = fromDoc
          ? buildBlockPage(
              parent,
              ref.blockId,
              fromDoc.attrs?.language === 'typescript' ? 'typescript' : 'javascript',
              blockText(fromDoc)
            )
          : existing
            ? existing
            : buildBlockPage(parent, ref.blockId, 'javascript', '')
        storePage(next)
        setPage(next)
        window.localStorage.setItem(PAGE_KEY, id)
        setTabs((current) => {
          const pinned = placeTab(current, id, parent.spaceId, Boolean(options?.newTab))
          window.localStorage.setItem(TABS_KEY, JSON.stringify(pinned))
          return pinned
        })
        return
      }
      const cached = pagesByIdRef.current[id]
      if (cached) {
        setPage(cached)
        setActiveFolderId(cached.folderId)
      }
      setSpaceId(nextSpaceId)
      setPaneFocus('main')
      if (beside?.pageId === id) {
        setBeside(null)
        window.localStorage.removeItem(BESIDE_KEY)
      }
      window.localStorage.setItem(PAGE_KEY, id)
      window.localStorage.setItem(SPACE_KEY, nextSpaceId)
      setTabs((current) => {
        const pinned = placeTab(current, id, nextSpaceId, Boolean(options?.newTab))
        window.localStorage.setItem(TABS_KEY, JSON.stringify(pinned))
        return pinned
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
    [beside?.pageId, openDesk, placeTab, rememberGuideData, spaceId, spaces, storePage, trees]
  )

  useEffect(() => {
    selectPageRef.current = selectPage
  }, [selectPage])

  const closeTab = useCallback(
    (pageId: string) => {
      if (isDeskPageId(pageId)) return
      setTabs((current) => {
        const host = spaceId ?? current.find((tab) => !isDeskPageId(tab.pageId))?.spaceId ?? ''
        const nextTabs = pinDesk(
          current.filter((tab) => tab.pageId !== pageId),
          host
        )
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        dropPages([pageId])
        if (beside && (beside.pageId === pageId || page?.id === pageId)) {
          setBeside(null)
          window.localStorage.removeItem(BESIDE_KEY)
          setPaneFocus('main')
        }
        if (page?.id === pageId) {
          const fallback = nextTabs.find(
            (tab) => !isDeskPageId(tab.pageId) && tab.pageId !== pageId
          )
          if (fallback) void selectPage(fallback.pageId, fallback.spaceId)
          else openDesk()
        }
        return nextTabs
      })
    },
    [beside, dropPages, openDesk, page?.id, selectPage, spaceId]
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
        const { list, trees: nextTrees } = await refreshSpaces()
        const config = await api.app.getConfig()
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
        const hostSpace =
          (storedSpace && list.some((space) => space.id === storedSpace)
            ? storedSpace
            : list[0]?.id) ?? ''
        const validTabs = pinDesk(
          parsedTabs.filter(
            (tab) =>
              isGuidePageId(tab.pageId) ||
              isBlockPageId(tab.pageId) ||
              (!isDeskPageId(tab.pageId) && list.some((space) => space.id === tab.spaceId))
          ),
          hostSpace
        )
        setTabs(validTabs)
        window.localStorage.setItem(TABS_KEY, JSON.stringify(validTabs))
        storePage(buildDeskPage(hostSpace))

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

        const welcome = collectPages(nextTrees).find((item) => item.page.title === 'Welcome')
        const preferredPage =
          storedPage &&
          !isDeskPageId(storedPage) &&
          validTabs.some((tab) => tab.pageId === storedPage)
            ? validTabs.find((tab) => tab.pageId === storedPage)
            : validTabs[0]
        if (config.seededThisLaunch && welcome) {
          await selectPageRef.current(welcome.page.id, welcome.spaceId)
        } else if (preferredPage) {
          await selectPageRef.current(preferredPage.pageId, preferredPage.spaceId)
        } else {
          await selectPageRef.current(DESK_PAGE_ID, hostSpace)
        }

        let parsedBeside: TabRef | null = null
        try {
          const storedBeside = window.localStorage.getItem(BESIDE_KEY)
          parsedBeside = storedBeside ? (JSON.parse(storedBeside) as TabRef) : null
        } catch {
          parsedBeside = null
        }
        const mainId = pageRef.current?.id
        const besideOk =
          parsedBeside &&
          parsedBeside.pageId &&
          parsedBeside.pageId !== mainId &&
          !isDeskPageId(parsedBeside.pageId) &&
          !isGuidePageId(parsedBeside.pageId) &&
          !isBlockPageId(parsedBeside.pageId) &&
          list.some((space) => space.id === parsedBeside.spaceId)
        if (besideOk && parsedBeside) {
          const nextBeside = parsedBeside
          const loaded = await api.pages.get({ id: nextBeside.pageId }).catch(() => null)
          if (loaded && !loaded.archived) {
            storePage(loaded)
            setBeside(nextBeside)
            setTabs((current) => {
              if (!current.some((tab) => tab.pageId === nextBeside.pageId)) return current
              const host = pageRef.current?.spaceId ?? nextBeside.spaceId
              const pinned = pinDesk(
                current.filter((tab) => tab.pageId !== nextBeside.pageId),
                host
              )
              window.localStorage.setItem(TABS_KEY, JSON.stringify(pinned))
              return pinned
            })
          } else {
            window.localStorage.removeItem(BESIDE_KEY)
          }
        } else if (parsedBeside) {
          window.localStorage.removeItem(BESIDE_KEY)
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load workspace')
      } finally {
        setReady(true)
      }
    })()
  }, [refreshSpaces, storePage])

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
    async (
      nextSpaceId: string,
      type: PageType,
      title: string,
      content?: string,
      options?: SelectPageOptions
    ) => {
      const created = await api.pages.create({
        spaceId: nextSpaceId,
        folderId: spaceId === nextSpaceId ? activeFolderId : null,
        type,
        title,
        content
      })
      await refreshTree(nextSpaceId)
      await selectPage(created.id, nextSpaceId, options)
    },
    [activeFolderId, refreshTree, selectPage, spaceId]
  )

  const importCsv = useCallback(
    async (nextSpaceId: string, options?: SelectPageOptions) => {
      const picked = await api.app.pickCsv()
      if (!picked) return
      await createPage(nextSpaceId, 'csv', picked.name, picked.content, options)
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
        const removed = current
          .filter((tab) => tab.spaceId === id && !isDeskPageId(tab.pageId))
          .map((tab) => tab.pageId)
        dropPages(removed)
        return current.filter((tab) => tab.spaceId !== id || isDeskPageId(tab.pageId))
      })
      const { list } = await refreshSpaces()
      const nextHost = list[0]?.id ?? ''
      if (list[0] && spaceId === id) setSpaceId(list[0].id)
      if (!list[0]) setSpaceId(null)
      setTabs((current) => {
        const pinned = pinDesk(
          current.filter(
            (tab) => isDeskPageId(tab.pageId) || list.some((space) => space.id === tab.spaceId)
          ),
          nextHost
        )
        window.localStorage.setItem(TABS_KEY, JSON.stringify(pinned))
        return pinned
      })
      storePage(buildDeskPage(nextHost))
      if (page?.id && isDeskPageId(page.id)) {
        setPage(buildDeskPage(nextHost))
      } else if (page?.spaceId === id) {
        openDesk()
      }
      setBeside((current) => {
        if (current?.spaceId === id) {
          window.localStorage.removeItem(BESIDE_KEY)
          setPaneFocus('main')
          return null
        }
        return current
      })
    },
    [dropPages, openDesk, page, refreshSpaces, spaceId, storePage]
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      await api.folders.delete({ id })
      if (activeFolderId === id) setActiveFolderId(null)
      if (spaceId) await refreshTree(spaceId)
    },
    [activeFolderId, refreshTree, spaceId]
  )

  const archivePage = useCallback(
    async (id: string) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, archived: true })
      dropPages([id])
      setTabs((current) => {
        const host = spaceId ?? spaces[0]?.id ?? ''
        const nextTabs = pinDesk(
          current.filter((tab) => {
            if (tab.pageId === id) return false
            const ref = parseBlockPageId(tab.pageId)
            return !ref || ref.pageId !== id
          }),
          host
        )
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        return nextTabs
      })
      const viewing = pageRef.current?.id
      const viewingBlock = viewing ? parseBlockPageId(viewing) : null
      if (viewing === id || viewingBlock?.pageId === id) openDesk()
      setBeside((current) => {
        if (current?.pageId === id) {
          window.localStorage.removeItem(BESIDE_KEY)
          return null
        }
        return current
      })
      await refreshTree(updated.spaceId)
    },
    [dropPages, openDesk, refreshTree, spaceId, spaces]
  )

  const unarchivePage = useCallback(
    async (id: string) => {
      const updated = await api.pages.update({ id, archived: false })
      storePage(updated)
      await refreshTree(updated.spaceId)
    },
    [refreshTree, storePage]
  )

  const restorePage = useCallback(
    async (id: string) => {
      const updated = await api.pages.restore({ id })
      storePage(updated)
      await refreshTree(updated.spaceId)
    },
    [refreshTree, storePage]
  )

  const purgePage = useCallback(
    async (id: string) => {
      await api.pages.purge({ id })
      dropPages([id])
      setTabs((current) => {
        const host = spaceId ?? spaces[0]?.id ?? ''
        const nextTabs = pinDesk(
          current.filter((tab) => tab.pageId !== id),
          host
        )
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        return nextTabs
      })
      if (pageRef.current?.id === id) openDesk()
      if (spaceId) await refreshTree(spaceId)
    },
    [dropPages, openDesk, refreshTree, spaceId, spaces]
  )

  const togglePinTab = useCallback((pageId: string) => {
    if (isDeskPageId(pageId)) return
    setPinnedTabIds((current) => {
      const next = current.includes(pageId)
        ? current.filter((id) => id !== pageId)
        : [...current, pageId]
      window.localStorage.setItem('paper.pinnedTabs', JSON.stringify(next))
      return next
    })
  }, [])

  const exportBackup = useCallback(async () => {
    try {
      await api.spaces.exportBackup()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to export backup')
    }
  }, [])

  const importBackup = useCallback(async () => {
    try {
      const count = await api.spaces.importBackup()
      if (count == null) return
      await refreshSpaces()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import backup')
    }
  }, [refreshSpaces])

  const flushSave = useCallback(async (id: string) => {
    const current = pagesByIdRef.current[id]
    if (!current || isLockedPageId(id)) return
    await api.pages.snapshot({ id })
  }, [])

  const updatePageFlags = useCallback(
    async (id: string, flags: { locked?: boolean; spellcheck?: boolean }) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, ...flags })
      storePage(updated)
    },
    [storePage]
  )

  const restorePageVersion = useCallback(
    async (id: string, versionId: string) => {
      const updated = await api.pages.restoreVersion({ id, versionId })
      storePage(updated)
    },
    [storePage]
  )

  const changePageType = useCallback(
    async (id: string, type: PageType) => {
      if (isLockedPageId(id)) return
      const updated = await api.pages.update({ id, type })
      storePage(updated)
      setPage((current) => (current?.id === id ? updated : current))
      await refreshTree(updated.spaceId)
    },
    [refreshTree, storePage]
  )

  const deletePage = useCallback(
    async (id: string) => {
      const spaceForPage = page?.id === id ? page.spaceId : spaceId
      await api.pages.delete({ id })
      dropPages([id])
      setTabs((current) => {
        const host = spaceId ?? spaces[0]?.id ?? ''
        const nextTabs = pinDesk(
          current.filter((tab) => {
            if (tab.pageId === id) return false
            const ref = parseBlockPageId(tab.pageId)
            return !ref || ref.pageId !== id
          }),
          host
        )
        window.localStorage.setItem(TABS_KEY, JSON.stringify(nextTabs))
        return nextTabs
      })
      const viewing = page?.id
      const viewingBlock = viewing ? parseBlockPageId(viewing) : null
      if (viewing === id || viewingBlock?.pageId === id) {
        openDesk()
      }
      setBeside((current) => {
        if (current?.pageId === id) {
          window.localStorage.removeItem(BESIDE_KEY)
          setPaneFocus('main')
          return null
        }
        return current
      })
      if (spaceForPage) await refreshTree(spaceForPage)
    },
    [dropPages, openDesk, page, refreshTree, spaceId, spaces]
  )

  const openBeside = useCallback(
    async (id: string, nextSpaceId: string) => {
      if (isDeskPageId(id) || isGuidePageId(id) || isBlockPageId(id)) return
      if (pageRef.current?.id === id) return
      if (!pagesByIdRef.current[id]) {
        const next = await api.pages.get({ id })
        storePage(next)
      }
      const ref = { pageId: id, spaceId: nextSpaceId }
      setBeside(ref)
      setPaneFocus('beside')
      window.localStorage.setItem(BESIDE_KEY, JSON.stringify(ref))
      setTabs((current) => {
        if (!current.some((tab) => tab.pageId === id)) return current
        const host = pageRef.current?.spaceId ?? nextSpaceId
        const pinned = pinDesk(
          current.filter((tab) => tab.pageId !== id),
          host
        )
        window.localStorage.setItem(TABS_KEY, JSON.stringify(pinned))
        return pinned
      })
    },
    [storePage]
  )

  const closeBeside = useCallback(() => {
    setBeside(null)
    setPaneFocus('main')
    window.localStorage.removeItem(BESIDE_KEY)
  }, [])

  const exportSpace = useCallback(async (id: string) => {
    try {
      await api.spaces.exportToFolder({ id })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to export space')
    }
  }, [])

  const importSpace = useCallback(async () => {
    try {
      const space = await api.spaces.importFromFolder()
      if (!space) return
      await refreshSpaces()
      setOpenSpaceIds((current) => [...current, space.id])
      setSpaceId(space.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to import space')
    }
  }, [refreshSpaces])

  const movePage = useCallback(
    async (input: { id: string; folderId?: string | null; beforeId?: string | null }) => {
      await api.pages.move(input)
      if (spaceId) await refreshTree(spaceId)
    },
    [refreshTree, spaceId]
  )

  const moveFolder = useCallback(
    async (input: { id: string; parentId?: string | null; beforeId?: string | null }) => {
      await api.folders.move(input)
      if (spaceId) await refreshTree(spaceId)
    },
    [refreshTree, spaceId]
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
      openRunBlock,
      saveBlockContent,
      closeTab,
      beside,
      paneFocus,
      setPaneFocus,
      openBeside,
      closeBeside,
      exportSpace,
      importSpace,
      movePage,
      moveFolder,
      showArchived,
      setShowArchived,
      showTrash,
      setShowTrash,
      restorePage,
      purgePage,
      pinnedTabIds,
      togglePinTab,
      exportBackup,
      importBackup,
      flushSave,
      updatePageFlags,
      restorePageVersion,
      archivePage,
      unarchivePage,
      changePageType,
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
      archivePage,
      beside,
      changePageType,
      closeBeside,
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
      exportBackup,
      exportSpace,
      flushSave,
      updatePageFlags,
      restorePageVersion,
      importBackup,
      importCsv,
      importSpace,
      moveFolder,
      movePage,
      openBeside,
      openDesk,
      paneFocus,
      openGuide,
      openRunBlock,
      openSpaceIds,
      saveBlockContent,
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
      setPageRunning,
      showArchived,
      setShowArchived,
      showTrash,
      setShowTrash,
      restorePage,
      purgePage,
      pinnedTabIds,
      togglePinTab,
      unarchivePage
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
