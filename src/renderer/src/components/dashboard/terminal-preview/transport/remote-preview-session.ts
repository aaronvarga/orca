import type {
  RemoteRuntimeMultiplexedTerminal,
  RemoteRuntimeMultiplexedTerminalCallbacks
} from '@/runtime/hosted-terminals/streams/remote-terminal-stream-contracts'
import type {
  TerminalPreviewConnection,
  TerminalPreviewConnectResult,
  TerminalPreviewReplayChunk
} from '../../../../../../shared/terminal/replay/terminal-preview'
const FALLBACK_COLS = 80
const FALLBACK_ROWS = 24

type SnapshotMeta = Parameters<RemoteRuntimeMultiplexedTerminalCallbacks['onSnapshot']>[1]
type OutputMeta = Parameters<RemoteRuntimeMultiplexedTerminalCallbacks['onData']>[1]
type HeldChunk = { data: string; meta: OutputMeta; release: () => void }

export type PreviewSession = {
  connection?: TerminalPreviewConnection
  identityConfirmed: boolean
  stream: RemoteRuntimeMultiplexedTerminal | null
  /** The pending first connect; a refresh issued before it lands shares it. */
  opening: Promise<TerminalPreviewConnectResult> | null
  finishOpening: ((result: TerminalPreviewConnectResult) => void) | null
  /** The host ended the stream; the pane is gone or unreachable, never "exited" by guess. */
  ended: boolean
  closed: boolean
  /** Live chunks held while a snapshot is in flight, so the boundary can drop covered bytes. */
  gate: HeldChunk[] | null
  /** Output high-water of the applied snapshot; a tagged request still forwards covered chunks. */
  snapshotSeq: number | undefined
  /** Transport credit per emitted chunk, returned in order as the preview parses them. */
  credits: (() => void)[]
  grid: { cols: number; rows: number } | null
}

export function snapshotResult(
  session: PreviewSession,
  data: string,
  meta: SnapshotMeta,
  replay: TerminalPreviewReplayChunk[]
): TerminalPreviewConnectResult {
  session.grid =
    typeof meta?.cols === 'number' && typeof meta.rows === 'number'
      ? { cols: meta.cols, rows: meta.rows }
      : null
  return {
    snapshot: {
      data,
      // Why: hosts that omit dims serialized at the PTY grid; the box fit and claim correct it.
      cols: meta?.cols ?? FALLBACK_COLS,
      rows: meta?.rows ?? FALLBACK_ROWS,
      seq: meta?.seq,
      pendingEscapeTailAnsi: meta?.pendingEscapeTailAnsi,
      kittyKeyboardFlags: meta?.kittyKeyboardFlags
    },
    replay
  }
}

/** The part of a chunk the snapshot at `snapshotSeq` does not already contain. */
export function outputAfterSnapshot(
  data: string,
  meta: OutputMeta,
  snapshotSeq: number | undefined
): string | null {
  const seq = meta?.seq
  const rawLength = meta?.rawLength ?? (meta?.transformed ? undefined : data.length)
  if (snapshotSeq === undefined || seq === undefined || rawLength === undefined) {
    return data
  }
  if (seq <= snapshotSeq) {
    return null
  }
  const start = seq - rawLength
  if (start >= snapshotSeq) {
    return data
  }
  // A transformed span cannot be split by offset; the host drops it on the same boundary.
  return meta?.transformed ? null : data.slice(snapshotSeq - start)
}

// Why: chunks flushed before a requested snapshot carry no proof of order without a seq.
export function releaseGate(session: PreviewSession, snapshotSeq: number | undefined) {
  const held = session.gate ?? []
  session.gate = null
  session.snapshotSeq = snapshotSeq
  const replay: TerminalPreviewReplayChunk[] = []
  for (const chunk of held) {
    const data =
      chunk.meta?.seq === undefined
        ? null
        : outputAfterSnapshot(chunk.data, chunk.meta, snapshotSeq)
    if (data) {
      replay.push({ data, mode: 'live' })
    }
    chunk.release()
  }
  return replay
}

export function releaseCredits(session: PreviewSession): void {
  for (const release of session.credits.splice(0)) {
    release()
  }
  for (const chunk of session.gate?.splice(0) ?? []) {
    chunk.release()
  }
}
