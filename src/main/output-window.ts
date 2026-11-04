import { BrowserWindow, ipcMain, type WebContents } from 'electron'
import type { OutputSnapshot } from '../shared/api'
import { createPaperWindow, loadRenderer } from './window'

type Slot = {
  key: string
  window: BrowserWindow
  owner: WebContents
}

const slots = new Map<string, Slot>()
const snapshots = new Map<string, OutputSnapshot>()

function slotFor(contents: WebContents): Slot | undefined {
  for (const slot of slots.values()) {
    if (!slot.window.isDestroyed() && slot.window.webContents.id === contents.id) return slot
  }
  return undefined
}

function sendState(slot: Slot): void {
  const snapshot = snapshots.get(slot.key)
  if (!snapshot || slot.window.isDestroyed()) return
  slot.window.webContents.send('paper:output-state', snapshot)
}

function remember(snapshot: OutputSnapshot, owner: WebContents): Slot | undefined {
  snapshots.set(snapshot.key, snapshot)
  const existing = slots.get(snapshot.key)
  if (!existing || existing.window.isDestroyed()) return undefined
  existing.owner = owner
  sendState(existing)
  return existing
}

export function registerOutputWindows(): void {
  ipcMain.handle('paper:output-open', (event, snapshot: OutputSnapshot) => {
    const open = remember(snapshot, event.sender)
    if (open) {
      open.window.show()
      open.window.focus()
      return
    }

    const parent = BrowserWindow.fromWebContents(event.sender)
    const win = createPaperWindow({
      title: snapshot.title ? `Output — ${snapshot.title}` : 'Output',
      width: 720,
      height: 520,
      minWidth: 480,
      minHeight: 320
    })
    if (parent) {
      const [x, y] = parent.getPosition()
      win.setPosition(x + 56, y + 48)
    }
    const slot: Slot = { key: snapshot.key, window: win, owner: event.sender }
    slots.set(snapshot.key, slot)
    snapshots.set(snapshot.key, snapshot)
    win.on('closed', () => {
      if (slots.get(snapshot.key)?.window === win) slots.delete(snapshot.key)
      if (!slot.owner.isDestroyed()) slot.owner.send('paper:output-closed', snapshot.key)
    })
    loadRenderer(win, `paper=output&key=${encodeURIComponent(snapshot.key)}`)
  })

  ipcMain.on('paper:output-update', (event, snapshot: OutputSnapshot) => {
    remember(snapshot, event.sender)
  })

  ipcMain.handle('paper:output-dock', (_event, key: string) => {
    const slot = slots.get(key)
    if (slot && !slot.window.isDestroyed()) slot.window.close()
  })

  ipcMain.handle('paper:output-is-open', (_event, key: string) => {
    const slot = slots.get(key)
    return Boolean(slot && !slot.window.isDestroyed())
  })

  ipcMain.handle('paper:output-hello', (event) => {
    const slot = slotFor(event.sender)
    if (!slot) return null
    return snapshots.get(slot.key) ?? null
  })

  ipcMain.on('paper:output-clear', (event) => {
    const slot = slotFor(event.sender)
    if (!slot) return
    const current = snapshots.get(slot.key)
    if (!current) return
    const next: OutputSnapshot = { ...current, run: null, running: false }
    snapshots.set(slot.key, next)
    sendState(slot)
    if (!slot.owner.isDestroyed()) slot.owner.send('paper:output-cleared', slot.key)
  })

  ipcMain.on('paper:close-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })
}
