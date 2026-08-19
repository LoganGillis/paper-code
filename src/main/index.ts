import { app, BrowserWindow, Menu, ipcMain, shell, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getPrisma } from './db'
import { registerRpc } from './rpc'
import { seedIfEmpty } from './seed'
import { checkForUpdates, initUpdates } from './updates'

app.setName('Paper')

ipcMain.on('paper:set-title', (event, title: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.setTitle(typeof title === 'string' && title.trim() ? title : 'Paper')
})

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Paper',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    ...(isMac
      ? { acceptFirstMouse: true }
      : {
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#6b6560',
            height: 44
          }
        }),
    backgroundColor: '#f7f5f1',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    const mod = process.platform === 'darwin' ? input.meta : input.control
    if (mod && !input.alt && !input.shift && input.key.toLowerCase() === 'w') {
      event.preventDefault()
      mainWindow.webContents.send('paper:close-tab')
    }
  })

  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.misspelledWord && params.dictionarySuggestions.length === 0) return
    mainWindow.webContents.send('paper:spell-context', {
      misspelledWord: params.misspelledWord,
      suggestions: params.dictionarySuggestions
    })
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function installMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'Paper',
            submenu: [
              { role: 'about' as const, label: 'About Paper' },
              { type: 'separator' as const },
              {
                label: 'Check for Updates…',
                click: () => checkForUpdates()
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const, label: 'Hide Paper' },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Quit Paper' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: (_item, window) => {
            if (window instanceof BrowserWindow) {
              window.webContents.send('paper:close-tab')
            }
          }
        },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' },
        ...(!isMac
          ? [
              { type: 'separator' as const },
              { label: 'Check for Updates…', click: () => checkForUpdates() },
              { type: 'separator' as const },
              { role: 'quit' as const, label: 'Quit Paper' }
            ]
          : [])
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' as const },
        ...(is.dev
          ? [
              { type: 'separator' as const },
              { role: 'reload' as const },
              { role: 'forceReload' as const },
              { role: 'toggleDevTools' as const }
            ]
          : [])
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ type: 'separator' as const }, { role: 'close' as const }])
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }
  electronApp.setAppUserModelId('com.logangillis.paper')
  app.setAboutPanelOptions({
    applicationName: 'Paper',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: 'Copyright © 2026 Logan Gillis'
  })
  installMenu()
  initUpdates()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerRpc()

  try {
    const prisma = getPrisma()
    await seedIfEmpty(prisma)
  } catch (error) {
    console.error('Failed to initialize the database', error)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
