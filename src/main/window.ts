import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

export function createPaperWindow(options: {
  title: string
  width: number
  height: number
  minWidth: number
  minHeight: number
}): BrowserWindow {
  const mac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: options.width,
    height: options.height,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    show: false,
    autoHideMenuBar: true,
    title: options.title,
    titleBarStyle: mac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    ...(mac
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

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  return win
}

export function loadRenderer(win: BrowserWindow, search = ''): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    const extra = new URLSearchParams(search)
    extra.forEach((value, key) => url.searchParams.set(key, value))
    void win.loadURL(url.toString())
    return
  }
  void win.loadFile(join(__dirname, '../renderer/index.html'), {
    query: Object.fromEntries(new URLSearchParams(search))
  })
}
