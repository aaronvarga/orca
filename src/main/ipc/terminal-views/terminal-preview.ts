import { ipcMain, type WebContents } from 'electron'
import type {
  TerminalPreviewConnection,
  TerminalPreviewConnectResult,
  TerminalPreviewSnapshot
} from '../../../shared/terminal/replay/terminal-preview'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import { isDashboardPopoutRenderer } from '../../window/dashboard-popout-window'
import { isTrustedUIRenderer } from '../ui'
import { abortWhenRendererGone } from '../renderer-requests/renderer-lifetime-abort'
import {
  TERMINAL_PREVIEW_OUTPUT_BATCH_MAX_BYTES,
  TerminalPreviewOutputStream
} from './terminal-preview-output-stream'

import {
  findPreviewSubscription,
  isValidPtyId,
  subscriptionKey,
  validConnection,
  type PreviewArgs
} from './terminal-preview-connection'

function isTerminalPreviewRenderer(sender: WebContents): boolean {
  return isDashboardPopoutRenderer(sender) || isTrustedUIRenderer(sender)
}
/** Pop-out terminal transport with an atomic snapshot/live boundary. */
export function registerTerminalPreviewHandlers(runtime: OrcaRuntimeService): void {
  ipcMain.removeHandler('terminalPreview:connect')
  ipcMain.removeHandler('terminalPreview:unsubscribe')
  ipcMain.removeHandler('terminalPreview:input')
  ipcMain.removeHandler('terminalPreview:ack')
  ipcMain.removeHandler('terminalPreview:fit')

  const subscriptionsByContents = new Map<number, Map<string, TerminalPreviewOutputStream>>()
  const fitClaimsByContents = new Map<
    number,
    Map<string, { token: symbol; connectionToken?: string }>
  >()
  const rendererLifetimes = new Map<number, ReturnType<typeof abortWhenRendererGone>>()

  const previewViewerKey = (contentsId: number, key: string): string =>
    `terminal-preview:${contentsId}:${key}`

  const currentSubscription = (contentsId: number, args: PreviewArgs, requireIncarnation = true) =>
    findPreviewSubscription(
      subscriptionsByContents.get(contentsId),
      args,
      (ptyId) => runtime.getTerminalPreviewIncarnation(ptyId),
      requireIncarnation
    )

  const releaseFitClaim = (
    contentsId: number,
    key: string,
    expectedConnection?: { token?: string }
  ): void => {
    const claimed = fitClaimsByContents.get(contentsId)
    if (expectedConnection && claimed?.get(key)?.connectionToken !== expectedConnection.token) {
      return
    }
    if (!claimed?.delete(key)) {
      return
    }
    if (claimed.size === 0) {
      fitClaimsByContents.delete(contentsId)
    }
    void runtime
      .unregisterRemoteDesktopViewer(JSON.parse(key)[0], previewViewerKey(contentsId, key))
      .catch(() => undefined)
  }

  const removeSubscription = (subscription: TerminalPreviewOutputStream): void => {
    const perPty = subscriptionsByContents.get(subscription.contents.id)
    if (
      perPty?.get(subscriptionKey(subscription.ptyId, subscription.connection)) === subscription
    ) {
      perPty.delete(subscriptionKey(subscription.ptyId, subscription.connection))
    }
  }

  const disposeContents = (contentsId: number): void => {
    const lifetime = rendererLifetimes.get(contentsId)
    rendererLifetimes.delete(contentsId)
    lifetime?.dispose()
    const perPty = subscriptionsByContents.get(contentsId)
    if (perPty) {
      for (const subscription of perPty.values()) {
        subscription.dispose()
      }
      subscriptionsByContents.delete(contentsId)
    }
    for (const ptyId of fitClaimsByContents.get(contentsId)?.keys() ?? []) {
      releaseFitClaim(contentsId, ptyId)
    }
  }

  const subscriptionsFor = (contents: WebContents): Map<string, TerminalPreviewOutputStream> => {
    let perPty = subscriptionsByContents.get(contents.id)
    if (!perPty) {
      perPty = new Map()
      subscriptionsByContents.set(contents.id, perPty)
      const lifetime = abortWhenRendererGone(contents)
      rendererLifetimes.set(contents.id, lifetime)
      lifetime.signal.addEventListener('abort', () => disposeContents(contents.id), { once: true })
    }
    return perPty
  }

  ipcMain.handle(
    'terminalPreview:connect',
    async (
      event,
      args: {
        ptyId?: unknown
        opts?: { scrollbackRows?: unknown; connection?: TerminalPreviewConnection }
      }
    ): Promise<TerminalPreviewConnectResult> => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        !validConnection(args.opts?.connection)
      ) {
        return { snapshot: null, replay: [] }
      }
      const ptyId = args.ptyId
      const suppliedConnection = args.opts?.connection
      const incarnationId = runtime.getTerminalPreviewIncarnation(ptyId)
      if (suppliedConnection?.incarnationId && suppliedConnection.incarnationId !== incarnationId) {
        return { snapshot: null, replay: [] }
      }
      const connection = suppliedConnection
        ? { ...suppliedConnection, ...(incarnationId ? { incarnationId } : {}) }
        : undefined
      const key = subscriptionKey(ptyId, connection)
      const perPty = subscriptionsFor(event.sender)
      perPty.get(key)?.dispose()

      const subscription = new TerminalPreviewOutputStream(
        event.sender,
        ptyId,
        runtime.registerRawTerminalViewSubscriber(ptyId),
        removeSubscription,
        connection
      )
      const unsubscribeData = runtime.subscribeToTerminalData(ptyId, (data, meta) => {
        if (incarnationId && runtime.getTerminalPreviewIncarnation(ptyId) !== incarnationId) {
          subscription.requestResync()
          return
        }
        subscription.append(data, meta)
      })
      let previewSize = runtime.getTerminalSize(ptyId)
      const unsubscribeResize = runtime.subscribeToTerminalResize(ptyId, (event) => {
        if (previewSize?.cols === event.cols && previewSize.rows === event.rows) {
          return
        }
        previewSize = { cols: event.cols, rows: event.rows }
        subscription.requestResync()
      })
      subscription.setDataSubscription(() => {
        unsubscribeData()
        unsubscribeResize()
      })
      perPty.set(key, subscription)
      const previousClaim = fitClaimsByContents.get(event.sender.id)?.get(key)
      if (previousClaim) {
        fitClaimsByContents.get(event.sender.id)!.set(key, {
          token: Symbol('terminal-preview-reconnect'),
          connectionToken: connection?.connectionToken
        })
      }

      const requestedRows = args.opts?.scrollbackRows
      const scrollbackRows =
        typeof requestedRows === 'number' && Number.isFinite(requestedRows)
          ? Math.max(0, Math.min(1000, Math.floor(requestedRows)))
          : undefined
      let snapshot: TerminalPreviewSnapshot | null
      let resyncRequired = false
      try {
        snapshot = await runtime.serializeTerminalBuffer(ptyId, { scrollbackRows })
        if (subscription.consumeInitialOverflow() && !subscription.disposed) {
          snapshot = await runtime.serializeTerminalBuffer(ptyId, { scrollbackRows })
          if (subscription.consumeInitialOverflow()) {
            resyncRequired = true
          }
        }
      } catch {
        subscription.dispose()
        return { snapshot: null, replay: [] }
      }
      if (
        subscription.disposed ||
        (incarnationId && runtime.getTerminalPreviewIncarnation(ptyId) !== incarnationId)
      ) {
        subscription.dispose()
        return { snapshot: null, replay: [] }
      }
      if (!snapshot) {
        subscription.dispose()
        return { snapshot: null, replay: [] }
      }
      previewSize = { cols: snapshot.cols, rows: snapshot.rows }

      const replay = subscription.completeSnapshot(snapshot.seq)
      if (resyncRequired) {
        subscription.pauseForReconnect()
      }
      return { snapshot, replay, ...(resyncRequired ? { resyncRequired: true } : {}) }
    }
  )

  ipcMain.handle(
    'terminalPreview:input',
    (event, args: PreviewArgs & { data?: unknown }): Promise<boolean> => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        typeof args.data !== 'string' ||
        !currentSubscription(event.sender.id, args)
      ) {
        return Promise.resolve(false)
      }
      const subscription = currentSubscription(event.sender.id, args)
      return runtime.writeTerminalPreviewInput(
        args.ptyId,
        args.data,
        () => currentSubscription(event.sender.id, args) === subscription
      )
    }
  )

  ipcMain.handle('terminalPreview:ack', (event, args: PreviewArgs & { bytes?: unknown }): void => {
    if (
      !isTerminalPreviewRenderer(event.sender) ||
      !isValidPtyId(args?.ptyId) ||
      typeof args.bytes !== 'number' ||
      !Number.isFinite(args.bytes) ||
      args.bytes <= 0 ||
      args.bytes > TERMINAL_PREVIEW_OUTPUT_BATCH_MAX_BYTES
    ) {
      return
    }
    currentSubscription(event.sender.id, args)?.acknowledge(args.bytes)
  })

  ipcMain.handle(
    'terminalPreview:fit',
    async (
      event,
      args: PreviewArgs & { cols?: unknown; rows?: unknown; intent?: 'passive' | 'claim' }
    ): Promise<{ cols: number; rows: number } | null> => {
      if (
        !isTerminalPreviewRenderer(event.sender) ||
        !isValidPtyId(args?.ptyId) ||
        typeof args.cols !== 'number' ||
        typeof args.rows !== 'number' ||
        !Number.isFinite(args.cols) ||
        !Number.isFinite(args.rows)
      ) {
        return null
      }
      const ptyId = args.ptyId
      const subscription = currentSubscription(event.sender.id, args)
      if (!subscription) {
        return null
      }
      const key = subscriptionKey(ptyId, args.connection)
      subscriptionsFor(event.sender)
      let claimed = fitClaimsByContents.get(event.sender.id)
      if (!claimed) {
        claimed = new Map()
        fitClaimsByContents.set(event.sender.id, claimed)
      }
      const claimToken = Symbol('terminal-preview-fit')
      claimed.set(key, { token: claimToken, connectionToken: args.connection?.connectionToken })
      const viewerKey = previewViewerKey(event.sender.id, key)
      try {
        const applied = await runtime.updateRemoteDesktopViewer(
          ptyId,
          viewerKey,
          viewerKey,
          args.cols,
          args.rows,
          args.intent !== 'passive'
        )
        if (fitClaimsByContents.get(event.sender.id)?.get(key)?.token !== claimToken) {
          return null
        }
        if (!applied) {
          releaseFitClaim(event.sender.id, key)
          return null
        }
      } catch {
        if (fitClaimsByContents.get(event.sender.id)?.get(key)?.token === claimToken) {
          releaseFitClaim(event.sender.id, key)
        }
        return null
      }
      return runtime.getTerminalSize(ptyId)
    }
  )

  ipcMain.handle('terminalPreview:unsubscribe', (event, args: PreviewArgs): void => {
    if (!isTerminalPreviewRenderer(event.sender) || !isValidPtyId(args?.ptyId)) {
      return
    }
    if (!validConnection(args.connection)) {
      return
    }
    currentSubscription(event.sender.id, args, false)?.dispose()
    releaseFitClaim(event.sender.id, subscriptionKey(args.ptyId, args.connection), {
      token: args.connection?.connectionToken
    })
  })
}
