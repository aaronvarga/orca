import type { ForkReleaseStatus } from '../../../shared/updater/fork-release-status'
import { ipcRenderer } from 'electron'
import type { UpdateStatus } from '../../../shared/updater/update-status-types'
import { prepareAndInvokeUpdaterInstall } from '../../renderer/restart/renderer-restart-wiring'
import { awaitBeforeUnloadCheckpoint, updaterQuitAbortRelay } from '../../renderer/renderer-runtime'
import type { PreloadApi } from '../../api-types'

export const updaterApi = {
  getForkReleaseStatus: () => ipcRenderer.invoke('updater:getForkReleaseStatus').catch(() => null),
  checkForkRelease: () => ipcRenderer.invoke('updater:checkForkRelease'),
  onForkReleaseStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: ForkReleaseStatus) =>
      callback(status)
    ipcRenderer.on('updater:forkReleaseStatus', listener)
    return () => ipcRenderer.removeListener('updater:forkReleaseStatus', listener)
  },
  getStatus: () => ipcRenderer.invoke('updater:getStatus'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  check: (options) => ipcRenderer.invoke('updater:check', options),
  download: () => ipcRenderer.invoke('updater:download'),
  dismissNudge: () => ipcRenderer.invoke('updater:dismissNudge'),
  dismissAvailableUpdate: () => ipcRenderer.invoke('updater:dismissAvailableUpdate'),
  getLinuxPackageInstallInstructions: () =>
    ipcRenderer.invoke('updater:getLinuxPackageInstallInstructions'),
  showLinuxPackage: () => ipcRenderer.invoke('updater:showLinuxPackage'),
  listBuilds: (channel, options) => ipcRenderer.invoke('updater:listBuilds', channel, options),
  quitAndInstall: (): Promise<void> =>
    prepareAndInvokeUpdaterInstall(
      window,
      updaterQuitAbortRelay,
      () => ipcRenderer.invoke('updater:quitAndInstall'),
      awaitBeforeUnloadCheckpoint
    ),

  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  onClearDismissal: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('updater:clearDismissal', listener)
    return () => ipcRenderer.removeListener('updater:clearDismissal', listener)
  }
} satisfies PreloadApi['updater']
