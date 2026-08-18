import { createRequire } from 'node:module'
import { BrowserWindow, app } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { UpdateStatus } from '../shared/api'

const { autoUpdater } = createRequire(import.meta.url)('electron-updater') as {
  autoUpdater: typeof import('electron-updater').autoUpdater
}

let status: UpdateStatus = {
  state: 'idle',
  currentVersion: app.getVersion()
}

function emit(): void {
  status = { ...status, currentVersion: app.getVersion() }
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('paper:update-status', status)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return { ...status, currentVersion: app.getVersion() }
}

export function checkForUpdates(): void {
  if (is.dev) {
    status = {
      state: 'not-available',
      currentVersion: app.getVersion()
    }
    emit()
    return
  }
  void autoUpdater.checkForUpdates()
}

export function quitAndInstall(): void {
  if (is.dev || status.state !== 'ready') return
  autoUpdater.quitAndInstall()
}

export function initUpdates(): void {
  status.currentVersion = app.getVersion()
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    status = { ...status, state: 'checking', error: undefined }
    emit()
  })
  autoUpdater.on('update-available', (info) => {
    status = {
      ...status,
      state: 'available',
      availableVersion: info.version,
      error: undefined
    }
    emit()
  })
  autoUpdater.on('update-not-available', () => {
    status = { ...status, state: 'not-available', error: undefined }
    emit()
  })
  autoUpdater.on('download-progress', (progress) => {
    status = {
      ...status,
      state: 'downloading',
      percent: progress.percent
    }
    emit()
  })
  autoUpdater.on('update-downloaded', (info) => {
    status = {
      ...status,
      state: 'ready',
      availableVersion: info.version,
      percent: 100,
      error: undefined
    }
    emit()
  })
  autoUpdater.on('error', (error) => {
    status = {
      ...status,
      state: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
    emit()
  })

  if (!is.dev) {
    setTimeout(() => {
      void autoUpdater.checkForUpdates()
    }, 4000)
  }
}
