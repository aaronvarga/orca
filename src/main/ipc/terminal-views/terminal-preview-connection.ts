import type { TerminalPreviewOutputStream } from './terminal-preview-output-stream'
import type { TerminalPreviewConnection } from '../../../shared/terminal/replay/terminal-preview'

const PREVIEW_ID_MAX_LENGTH = 4096

export type PreviewArgs = { ptyId?: unknown; connection?: TerminalPreviewConnection }

export function validConnection(connection: TerminalPreviewConnection | undefined): boolean {
  return (
    connection === undefined ||
    (isValidPtyId(connection?.viewerId) &&
      isValidPtyId(connection?.connectionToken) &&
      (connection.incarnationId === undefined || isValidPtyId(connection.incarnationId)))
  )
}

export function subscriptionKey(ptyId: string, connection?: TerminalPreviewConnection): string {
  return JSON.stringify([ptyId, connection?.viewerId ?? 'legacy'])
}

export function isValidPtyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= PREVIEW_ID_MAX_LENGTH
}
export function findPreviewSubscription(
  subscriptions: Map<string, TerminalPreviewOutputStream> | undefined,
  args: PreviewArgs,
  getIncarnation: (ptyId: string) => string | null,
  requireIncarnation = true
): TerminalPreviewOutputStream | undefined {
  if (!isValidPtyId(args?.ptyId) || !validConnection(args.connection)) {
    return undefined
  }
  const stream = subscriptions?.get(subscriptionKey(args.ptyId, args.connection))
  if (
    !stream ||
    stream.disposed ||
    stream.connection?.connectionToken !== args.connection?.connectionToken
  ) {
    return undefined
  }
  const incarnation = stream.connection?.incarnationId
  if (
    requireIncarnation &&
    stream.connection &&
    (!incarnation || getIncarnation(args.ptyId) !== incarnation)
  ) {
    return undefined
  }
  return stream
}
