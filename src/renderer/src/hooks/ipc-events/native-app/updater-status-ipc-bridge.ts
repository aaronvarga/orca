import { toast } from 'sonner'
import type { UpdateStatus } from '../../../../../shared/updater/update-status-types'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '../../../store/index'

const AUTOMATIC_UPDATE_TOAST_ID = 'automatic-desktop-update'

function applyUpdaterStatus(status: UpdateStatus): void {
  const { updateStatus: previous, setUpdateStatus } = useAppStore.getState()
  setUpdateStatus(status)
  if (status.automaticDownload && status.state === 'downloading') {
    if (!previous.automaticDownload || previous.state !== 'downloading') {
      toast.info(
        translate('updates.automatic.downloading', 'Downloading Orca {{version}}…', {
          version: status.version
        }),
        { id: AUTOMATIC_UPDATE_TOAST_ID }
      )
    }
  } else if (status.automaticDownload && status.state === 'downloaded' && status.installing) {
    if (!previous.automaticDownload || previous.state !== 'downloaded' || !previous.installing) {
      toast.loading(
        translate('updates.automatic.installing', 'Installing Orca {{version}}…', {
          version: status.version
        }),
        {
          id: AUTOMATIC_UPDATE_TOAST_ID,
          description: translate('updates.automatic.restarting', 'Orca will restart automatically.')
        }
      )
    }
  } else if (previous.automaticDownload) {
    toast.dismiss(AUTOMATIC_UPDATE_TOAST_ID)
  }
}

/** Installs updater listeners in their historical snapshot-before-push order. */
export function registerUpdaterStatusIpcBridge(unsubs: (() => void)[]): void {
  let receivedForkStatus = false
  let disposed = false
  const unsubscribeFork = window.api.updater.onForkReleaseStatus?.((status) => {
    receivedForkStatus = true
    useAppStore.getState().setForkReleaseStatus(status)
  })
  unsubs.push(() => {
    disposed = true
    unsubscribeFork?.()
  })
  void window.api.updater
    .getForkReleaseStatus?.()
    .then((status) => {
      if (!disposed && !receivedForkStatus) {
        useAppStore.getState().setForkReleaseStatus(status)
      }
    })
    .catch(console.error)
  // Current behavior intentionally permits the initial snapshot to overwrite an earlier push.
  window.api.updater.getStatus().then(applyUpdaterStatus)

  unsubs.push(window.api.updater.onStatus(applyUpdaterStatus))
  unsubs.push(
    window.api.updater.onClearDismissal(() => {
      useAppStore.getState().clearDismissedUpdateVersion()
    })
  )
}
