import { AgentTerminalPreviewSurface } from './AgentTerminalPreviewSurface'
import type { TerminalComposerSendResult } from '../../terminal-pane/composer/terminal-composer-send'
import { createPreviewTerminalComposerSend } from './preview-terminal-composer-send'
import type { TerminalPreviewProps } from './terminal-preview-props'
import { useTerminalPreviewAppearance } from './use-terminal-preview-appearance'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSystemPrefersDark } from '@/hooks/theme/use-system-prefers-dark'
import { TerminalKittyKeyboardModeTracker } from '../../../../../shared/terminal/protocol/input-modes/terminal-kitty-keyboard-mode-tracker'
import { replayPreviewConnectionSnapshot } from './transport/preview-terminal-snapshot-replay'
import { useEffectiveMacOptionAsAlt } from '@/lib/keyboard-layout/use-effective-mac-option-as-alt'
import {
  buildPreviewAppearanceOptions,
  buildPreviewTerminalOptions,
  previewAdvertisesKittyKeyboard
} from '../../standalone-terminal/rendering/preview-terminal-options'
import { syncPreviewTerminalLigatures } from '../../standalone-terminal/rendering/preview-terminal-ligatures'
import { useAppStore } from '@/store/index'
import { usePluginFontReady } from '@/store/plugins/appearance/plugin-fonts'
import { createPreviewGridClaim } from './geometry/preview-grid-claim'
import { createPreviewBoxFit } from './geometry/preview-terminal-box-fit'
import { openStandaloneTerminal } from '../../standalone-terminal/open-standalone-terminal'
import type { StandaloneTerminal } from '../../standalone-terminal/open-standalone-terminal'
import { terminalPreviewApiFor } from './transport/terminal-preview-api'
import { LinkActionPopover } from '@/components/link-actions/LinkActionPopover'
import { closeLinkActionRequest } from '@/components/link-actions/link-action-request'
import type { LinkActionRequest } from '@/components/link-actions/link-action-request'
import { installDashboardPreviewLinkInteraction } from './links/dashboard-preview-link-interaction'
import type { PreviewTerminalLinkHandler } from '../../standalone-terminal/rendering/preview-terminal-links'
import type { Terminal } from '@xterm/xterm'
import type {
  TerminalPreviewConnection,
  TerminalPreviewDataPayload
} from '../../../../../shared/terminal/replay/terminal-preview'

const PREVIEW_SCROLLBACK_ROWS = 24
const PREVIEW_SCROLLBACK_BUFFER_ROWS = 1000
const FALLBACK_COLS = 80
const FALLBACK_ROWS = 24
const RESYNC_RETRY_DELAY_MS = 150

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Claim the dialog’s grid, retaining real PTY dimensions when another owner requires scaling; stream input/output through a DOM renderer without WebGL. */
export function AgentTerminalPreview({
  ptyId,
  composerSessionKey,
  terminalInput = null,
  className,
  onRequestClose,
  linkSource,
  onBrowserForeground,
  viewerId,
  incarnationId,
  interactive = true,
  scaleToFit = true,
  claimOnMount = true
}: TerminalPreviewProps): React.JSX.Element {
  const sendComposerRef = useRef<
    (text: string, submit: boolean) => Promise<TerminalComposerSendResult>
  >(async () => 'paste-failed')
  const stableViewerId = useRef(viewerId ?? createNonSecureContextUuid())
  const activateRef = useRef<() => void>(() => {})
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const [linkRequest, setLinkRequest] = useState<LinkActionRequest | null>(null)
  const linkSourceRef = useRef(linkSource)
  const browserForegroundRef = useRef(onBrowserForeground)
  const settings = useAppStore((state) => state.settings)
  const terminalFontReady = usePluginFontReady(settings?.terminalFontFamily)
  const systemPrefersDark = useSystemPrefersDark()
  const macOptionAsAlt = useEffectiveMacOptionAsAlt(settings?.terminalMacOptionAsAlt)
  const settingsRef = useRef(settings)
  const macOptionAsAltRef = useRef(macOptionAsAlt)
  const terminalInputRef = useRef(terminalInput)
  const onRequestCloseRef = useRef(onRequestClose)
  const { terminalTheme, terminalMode } = useTerminalPreviewAppearance(settings, systemPrefersDark)
  const terminalMinimumContrastRatio = settings?.terminalMinimumContrastRatio
  const [ptyGone, setPtyGone] = useState(false)

  useLayoutEffect(() => {
    linkSourceRef.current = linkSource
    browserForegroundRef.current = onBrowserForeground
    settingsRef.current = settings
    macOptionAsAltRef.current = macOptionAsAlt
    terminalInputRef.current = terminalInput
    onRequestCloseRef.current = onRequestClose
  }, [settings, macOptionAsAlt, terminalInput, onRequestClose, linkSource, onBrowserForeground])

  useEffect(() => {
    setPtyGone(false)
    const container = containerRef.current
    if (!container) {
      return
    }
    let disposed = false
    let standalone: StandaloneTerminal | null = null
    let terminal: Terminal | null = null
    let offData: (() => void) | null = null
    const previewApi = terminalPreviewApiFor(ptyId)
    let linkDefaults: PreviewTerminalLinkHandler | undefined
    let linkInteraction: ReturnType<typeof installDashboardPreviewLinkInteraction> | null = null
    let connectionContext: TerminalPreviewConnection | null = null
    const sendInput = (data: string): boolean | Promise<boolean> =>
      !disposed && interactive && connectionContext
        ? previewApi.input(ptyId, data, connectionContext)
        : false
    sendComposerRef.current = createPreviewTerminalComposerSend({
      ptyId,
      getTerminal: () => terminal,
      getConnection: () => connectionContext,
      getInput: () => terminalInputRef.current,
      isAvailable: () => !disposed && interactive,
      write: sendInput
    })
    const installLinks = (): void => {
      if (!terminal || !linkSourceRef.current) {
        return
      }
      linkInteraction = installDashboardPreviewLinkInteraction(terminal, {
        getSettings: () => settingsRef.current,
        getSource: () => linkSourceRef.current,
        onForegroundOpen: () => browserForegroundRef.current,
        request: setLinkRequest,
        sendInput,
        defaultHandlers: linkDefaults
      })
    }
    const linkHandlers = (defaults: PreviewTerminalLinkHandler): PreviewTerminalLinkHandler => {
      linkDefaults = defaults
      return {
        activate: (event, uri, range) => linkInteraction?.handlers.activate(event, uri, range),
        hover: (event, uri, range) => linkInteraction?.handlers.hover?.(event, uri, range),
        leave: (event, uri, range) => linkInteraction?.handlers.leave?.(event, uri, range)
      }
    }
    const mountTerminalInput = terminalInputRef.current
    const kittyKeyboardModes = new TerminalKittyKeyboardModeTracker({
      kittyKeyboard: previewAdvertisesKittyKeyboard(mountTerminalInput)
    })
    let refreshInFlight = false
    let refreshAgain = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const pendingLivePayloads: Extract<TerminalPreviewDataPayload, { type: 'data' }>[] = []

    const boxFit = createPreviewBoxFit({ container, getTerminal: () => terminal, scaleToFit })

    const gridClaim = createPreviewGridClaim({
      ptyId,
      container,
      getTerminal: () => terminal,
      fit: (cols, rows, intent) =>
        connectionContext && !disposed && interactive
          ? previewApi.fit(ptyId, cols, rows, connectionContext, intent)
          : Promise.resolve(null)
    })
    activateRef.current = () => {
      if (disposed || !interactive) {
        return
      }
      gridClaim.schedule('claim')
      terminal?.focus()
    }
    let initiallyFitted = false
    const boxResizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            boxFit.schedule()
            gridClaim.schedule()
          })
    if (container.parentElement) {
      boxResizeObserver?.observe(container.parentElement)
    }
    boxResizeObserver?.observe(container)

    const writeReplayed = (chunk: string, onDone?: () => void, live = false): void => {
      standalone?.write(chunk, {
        live,
        onDone: () => {
          boxFit.schedule()
          onDone?.()
        }
      })
    }

    const writeLive = (payload: Extract<TerminalPreviewDataPayload, { type: 'data' }>): void => {
      if (!terminal) {
        pendingLivePayloads.push(payload)
        return
      }
      writeReplayed(
        payload.data,
        () => {
          if (
            !disposed &&
            payload.connection?.connectionToken === connectionContext?.connectionToken
          ) {
            void previewApi.ack(ptyId, payload.bytes, payload.connection)
          }
        },
        true
      )
    }

    const replayConnection = (
      connection: Awaited<ReturnType<typeof previewApi.connect>>,
      replaceExisting: boolean,
      requestRefresh: () => void
    ): void => {
      const snap = connection.snapshot!
      if (!terminal) {
        standalone = openStandaloneTerminal({
          container,
          clipboardTarget: linkSourceRef.current,
          options: buildPreviewTerminalOptions({
            settings: settingsRef.current,
            terminalInput: mountTerminalInput,
            macOptionIsMeta: macOptionAsAltRef.current === 'true',
            theme: terminalTheme,
            themeMode: terminalMode,
            cols: clamp(snap.cols ?? FALLBACK_COLS, 2, 500),
            rows: clamp(snap.rows ?? FALLBACK_ROWS, 2, 200),
            scrollback: PREVIEW_SCROLLBACK_BUFFER_ROWS
          }),
          kittyKeyboardModes,
          sessionKey: ptyId,
          sendInput: (data) =>
            linkInteraction ? linkInteraction.sendInput(data) : sendInput(data),
          ...(linkSourceRef.current ? { linkHandlers } : {}),
          answersQueries: false,
          getSettings: () => settingsRef.current,
          getMacOptionAsAlt: () => macOptionAsAltRef.current,
          getTerminalInput: () => terminalInputRef.current,
          requestClose: () => onRequestCloseRef.current?.()
        })
        if (!standalone) {
          return
        }
        terminal = standalone.terminal
        terminalRef.current = terminal
        installLinks()
      } else if (replaceExisting) {
        terminal.resize(
          clamp(snap.cols ?? FALLBACK_COLS, 2, 500),
          clamp(snap.rows ?? FALLBACK_ROWS, 2, 200)
        )
        linkInteraction?.dispose()
        linkInteraction = null
        terminal.reset()
        installLinks()
      }
      replayPreviewConnectionSnapshot({
        snapshot: snap,
        replay: connection.replay,
        kittyKeyboardModes,
        write: (chunk, live) => writeReplayed(chunk, undefined, live)
      })
      for (const payload of pendingLivePayloads.splice(0)) {
        writeLive(payload)
      }
      if (connection.resyncRequired) {
        refreshAgain = false
        writeReplayed('', () => {
          if (disposed || retryTimer) {
            return
          }
          retryTimer = setTimeout(() => {
            retryTimer = null
            requestRefresh()
          }, RESYNC_RETRY_DELAY_MS)
        })
      } else if (refreshAgain) {
        refreshAgain = false
        writeReplayed('', requestRefresh)
      }
      boxFit.schedule()
      gridClaim.schedule(!initiallyFitted && claimOnMount ? 'claim' : 'passive')
      initiallyFitted = true
    }

    const releaseTerminal = (): void => {
      offData?.()
      offData = null
      linkInteraction?.dispose()
      linkInteraction = null
      standalone?.dispose()
      standalone = null
      terminal = null
      terminalRef.current = null
      if (connectionContext) {
        void previewApi.unsubscribe(ptyId, connectionContext)
      }
    }

    const setup = async (replaceExisting = false): Promise<void> => {
      if (disposed) {
        return
      }
      if (refreshInFlight) {
        refreshAgain = true
        return
      }
      refreshInFlight = true
      const capturedConnection: TerminalPreviewConnection = {
        viewerId: stableViewerId.current,
        connectionToken: createNonSecureContextUuid(),
        ...(incarnationId ? { incarnationId } : {})
      }
      connectionContext = capturedConnection
      pendingLivePayloads.length = 0
      const connection = await previewApi
        .connect(ptyId, { scrollbackRows: PREVIEW_SCROLLBACK_ROWS, connection: capturedConnection })
        .catch(() => null)
      if (disposed || connectionContext !== capturedConnection) {
        void previewApi.unsubscribe(ptyId, capturedConnection)
        return
      }
      if (!connection?.snapshot) {
        refreshInFlight = false
        setPtyGone(true)
        releaseTerminal()
        return
      }
      refreshInFlight = false
      if (!connection.resyncRequired && retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      replayConnection(connection, replaceExisting, () => void setup(true))
    }

    offData = previewApi.onData((payload) => {
      if (
        disposed ||
        payload.ptyId !== ptyId ||
        payload.connection?.connectionToken !== connectionContext?.connectionToken
      ) {
        return
      }
      if (payload.type === 'resync') {
        void setup(true)
        return
      }
      writeLive(payload)
    })

    void setup()

    return () => {
      disposed = true
      boxFit.dispose()
      if (retryTimer) {
        clearTimeout(retryTimer)
      }
      gridClaim.dispose()
      boxResizeObserver?.disconnect()
      releaseTerminal()
    }
  }, [
    ptyId,
    incarnationId,
    interactive,
    claimOnMount,
    scaleToFit,
    terminalTheme,
    terminalMode,
    terminalMinimumContrastRatio,
    settings?.terminalFontSize,
    settings?.terminalFontFamily,
    settings?.terminalFontWeight,
    settings?.terminalFontWeightBold,
    settings?.terminalLineHeight,
    settings?.terminalLigatures
  ])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    Object.assign(
      terminal.options,
      buildPreviewAppearanceOptions(settings, macOptionAsAlt === 'true')
    )
    syncPreviewTerminalLigatures(terminal, settings)
  }, [settings, terminalFontReady, macOptionAsAlt])

  return (
    <AgentTerminalPreviewSurface
      composerTarget={
        linkSource?.executionHostId
          ? { worktreeId: linkSource.worktreeId, executionHostId: linkSource.executionHostId }
          : undefined
      }
      ptyId={ptyId}
      composerSessionKey={composerSessionKey}
      interactive={interactive}
      ptyGone={ptyGone}
      className={className}
      backgroundColor={terminalTheme?.background}
      terminalContainerRef={containerRef}
      onActivate={() => activateRef.current()}
      onSend={(text, submit) => sendComposerRef.current(text, submit)}
    >
      {linkRequest ? (
        <LinkActionPopover
          request={linkRequest}
          onClose={(dismissed) =>
            setLinkRequest((current) => closeLinkActionRequest(current, dismissed))
          }
          onOpenSettings={onBrowserForeground ?? null}
        />
      ) : null}
    </AgentTerminalPreviewSurface>
  )
}
