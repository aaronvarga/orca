import { app, ipcMain } from 'electron'
import { isTrustedUIRenderer, sendToTrustedUIRenderer } from '../../ipc/ui'
import { createForkReleaseMonitor } from '../releases/fork-release-monitor'
import { fetchLatestStableReleaseTag } from '../releases/updater-prerelease-feed'

let started = false

export function registerForkReleaseHandlers(): void {
  if (started) {
    return
  }
  started = true
  const monitor = createForkReleaseMonitor(
    app.getVersion(),
    () => fetchLatestStableReleaseTag({ requirePlatformManifest: false }),
    (status) => sendToTrustedUIRenderer('updater:forkReleaseStatus', status)
  )
  for (const channel of ['updater:getForkReleaseStatus', 'updater:checkForkRelease']) {
    ipcMain.handle(channel, (event) => {
      if (!isTrustedUIRenderer(event.sender)) {
        throw new Error('Unauthorized fork update sender')
      }
      return channel === 'updater:getForkReleaseStatus' ? monitor.getStatus() : monitor.check()
    })
  }
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const poll = async (): Promise<void> => {
    await monitor.check()
    if (!stopped) {
      timer = setTimeout(() => void poll(), 60 * 60 * 1000)
      timer.unref()
    }
  }
  app.once('will-quit', () => {
    stopped = true
    clearTimeout(timer)
  })
  void poll()
}
