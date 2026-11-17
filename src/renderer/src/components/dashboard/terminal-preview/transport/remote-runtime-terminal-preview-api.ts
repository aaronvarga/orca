import {
  snapshotResult,
  outputAfterSnapshot,
  releaseGate,
  releaseCredits,
  type PreviewSession
} from './remote-preview-session'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../../shared/identifiers/non-secure-context-uuid'
import { takeCurrentTerminalDeliveryCredit } from '@/lib/pane-manager/terminal-output/terminal-delivery-credit'
import { getRemoteRuntimeTerminalMultiplexer } from '@/runtime/hosted-terminals/streams/registry/remote-runtime-terminal-multiplexer-registry'
import { parseRemoteRuntimePtyId } from '../../../../../../shared/remote-runtime/remote-runtime-pty-id'
import type {
  TerminalPreviewConnection,
  TerminalPreviewConnectResult,
  TerminalPreviewDataPayload
} from '../../../../../../shared/terminal/replay/terminal-preview'

type TerminalPreviewApi = typeof window.api.terminalPreview

const CONNECT_TIMEOUT_MS = 15_000
const SNAPSHOT_RETRY_ATTEMPTS = 3
const SNAPSHOT_RETRY_DELAY_MS = 150
const UNAVAILABLE: TerminalPreviewConnectResult = { snapshot: null, replay: [] }

const sessions = new Map<string, PreviewSession>()
const listeners = new Set<(payload: TerminalPreviewDataPayload) => void>()

function sessionKey(ptyId: string, connection?: TerminalPreviewConnection): string {
  return JSON.stringify([ptyId, connection?.viewerId ?? 'legacy'])
}

function currentSession(
  ptyId: string,
  connection?: TerminalPreviewConnection
): PreviewSession | undefined {
  const session = sessions.get(sessionKey(ptyId, connection))
  return session &&
    !session.closed &&
    session.connection?.connectionToken === connection?.connectionToken
    ? session
    : undefined
}

function emit(payload: TerminalPreviewDataPayload, session: PreviewSession): void {
  if (session.closed) {
    return
  }
  if (session.connection) {
    payload = { ...payload, connection: session.connection }
  }
  for (const listener of listeners) {
    listener(payload)
  }
}

function closeSession(ptyId: string, session: PreviewSession): void {
  session.closed = true
  session.finishOpening?.(UNAVAILABLE)
  releaseCredits(session)
  session.stream?.close()
  session.stream = null
  if (sessions.get(sessionKey(ptyId, session.connection)) === session) {
    sessions.delete(sessionKey(ptyId, session.connection))
  }
}

function openSession(
  ptyId: string,
  environmentId: string,
  handle: string,
  connection?: TerminalPreviewConnection
) {
  const session: PreviewSession = {
    connection,
    identityConfirmed: !connection?.incarnationId,
    stream: null,
    opening: null,
    finishOpening: null,
    ended: false,
    closed: false,
    gate: [],
    snapshotSeq: undefined,
    credits: [],
    grid: null
  }
  sessions.set(sessionKey(ptyId, connection), session)
  let initialized = false
  const opening = new Promise<TerminalPreviewConnectResult>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      closeSession(ptyId, session)
      finish(UNAVAILABLE)
    }, CONNECT_TIMEOUT_MS)
    function finish(result: TerminalPreviewConnectResult): void {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        session.opening = null
        session.finishOpening = null
        resolve(result)
      }
    }
    session.finishOpening = finish
    const markEnded = (): void => {
      session.ended = true
      finish(UNAVAILABLE)
      if (initialized && !session.closed) {
        emit({ type: 'resync', ptyId }, session)
      }
    }
    void getRemoteRuntimeTerminalMultiplexer(environmentId)
      .subscribeTerminal({
        terminal: handle,
        // Why a preview-only id: its viewport claim must release with this stream, not a pane's.
        client: {
          id: `dashboard-preview:${connection?.viewerId ?? createBrowserUuid()}`,
          type: 'desktop'
        },
        callbacks: {
          onSubscribeAcknowledged: (result) => {
            if (session.closed) {
              return
            }
            session.identityConfirmed =
              !connection?.incarnationId || result?.incarnationId === connection.incarnationId
            if (!session.identityConfirmed) {
              closeSession(ptyId, session)
              finish(UNAVAILABLE)
            }
          },
          onSnapshot: (data, meta) => {
            if (session.closed) {
              return
            }
            if (initialized) {
              // A host-pushed recovery image follows dropped output; repaint through a fresh request.
              emit({ type: 'resync', ptyId }, session)
              return
            }
            initialized = true
            finish(snapshotResult(session, data, meta, releaseGate(session, meta?.seq)))
          },
          onData: (data, meta) => {
            if (session.closed) {
              return
            }
            const noCredit = (): void => {}
            if (session.gate) {
              session.gate.push({
                data,
                meta,
                release: takeCurrentTerminalDeliveryCredit() ?? noCredit
              })
              return
            }
            const uncovered = outputAfterSnapshot(data, meta, session.snapshotSeq)
            if (uncovered) {
              // Why: hold the host's credit until the preview parses the chunk, like a pane does.
              session.credits.push(takeCurrentTerminalDeliveryCredit() ?? noCredit)
              emit({ type: 'data', ptyId, data: uncovered, bytes: uncovered.length }, session)
            }
          },
          onFitOverrideChanged: (event) => {
            if (event.cols !== session.grid?.cols || event.rows !== session.grid?.rows) {
              emit({ type: 'resync', ptyId }, session)
            }
          },
          onEnd: markEnded,
          onError: markEnded,
          onTransportClose: () => {
            // Why: loss of contact is not pane death — drop the session so a resync reopens it.
            if (sessions.get(sessionKey(ptyId, session.connection)) === session) {
              sessions.delete(sessionKey(ptyId, session.connection))
            }
            session.stream = null
            releaseCredits(session)
            finish(UNAVAILABLE)
            if (initialized && !session.closed) {
              emit({ type: 'resync', ptyId }, session)
            }
          }
        }
      })
      .then(
        (stream) => {
          if (session.closed) {
            stream.close()
            return
          }
          session.stream = stream
        },
        () => {
          closeSession(ptyId, session)
          finish(UNAVAILABLE)
        }
      )
  })
  session.opening = opening
  return opening
}

async function refreshSession(
  ptyId: string,
  session: PreviewSession,
  scrollbackRows: number | undefined
): Promise<TerminalPreviewConnectResult> {
  const stream = session.stream
  if (!stream) {
    return UNAVAILABLE
  }
  session.gate = []
  for (let attempt = 0; attempt < SNAPSHOT_RETRY_ATTEMPTS; attempt++) {
    const outcome = await stream.serializeBufferOutcome({ scrollbackRows }).catch(() => null)
    if (session.closed) {
      return UNAVAILABLE
    }
    if (sessions.get(sessionKey(ptyId, session.connection)) !== session) {
      // The transport dropped mid-request; reopen rather than report the pane gone.
      return UNAVAILABLE
    }
    const snapshot = outcome?.snapshot
    if (snapshot) {
      return snapshotResult(session, snapshot.data, snapshot, releaseGate(session, snapshot.seq))
    }
    if (outcome?.availability.kind !== 'retry-worthy') {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_RETRY_DELAY_MS))
  }
  for (const chunk of session.gate?.splice(0) ?? []) {
    chunk.release()
  }
  session.gate = null
  return UNAVAILABLE
}

/** Reuse pane multiplexing: the owning paired host serializes snapshots and holds the live-output boundary. */
export const remoteRuntimeTerminalPreviewApi: TerminalPreviewApi = {
  connect: (ptyId, opts) => {
    const parts = parseRemoteRuntimePtyId(ptyId)
    // Why: an id without its owner cannot be routed; guessing the active server could show another host's pane.
    if (!parts?.environmentId) {
      return Promise.resolve(UNAVAILABLE)
    }
    const connection = opts?.connection
    const existing = sessions.get(sessionKey(ptyId, connection))
    if (existing && existing.connection?.connectionToken !== connection?.connectionToken) {
      closeSession(ptyId, existing)
    } else if (existing?.ended) {
      closeSession(ptyId, existing)
      return Promise.resolve(UNAVAILABLE)
    } else if (existing?.opening) {
      return existing.opening
    } else if (existing) {
      return refreshSession(ptyId, existing, opts?.scrollbackRows)
    }
    return openSession(ptyId, parts.environmentId, parts.handle, connection)
  },
  input: (ptyId, data, connection) => {
    const session = currentSession(ptyId, connection)
    return Promise.resolve(
      session?.identityConfirmed ? (session.stream?.sendInput(data) ?? false) : false
    )
  },
  fit: (ptyId, cols, rows, connection, intent) => {
    const session = currentSession(ptyId, connection)
    if (!session?.identityConfirmed) {
      return Promise.resolve(null)
    }
    const claimed =
      intent === 'passive'
        ? (session.stream?.resize(cols, rows) ?? false)
        : (session.stream?.claimViewport(cols, rows) ?? false)
    return Promise.resolve(claimed ? session.grid : null)
  },
  ack: (ptyId, _bytes, connection) => {
    currentSession(ptyId, connection)?.credits.shift()?.()
    return Promise.resolve()
  },
  unsubscribe: (ptyId, connection) => {
    const session = currentSession(ptyId, connection)
    if (session) {
      closeSession(ptyId, session)
    }
    return Promise.resolve()
  },
  onData: (callback) => {
    listeners.add(callback)
    return () => listeners.delete(callback)
  }
}

export function resetRemoteRuntimeTerminalPreviewSessionsForTests(): void {
  for (const [key, session] of sessions) {
    closeSession(JSON.parse(key)[0], session)
  }
  listeners.clear()
}
