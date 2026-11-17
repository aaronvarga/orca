import type {
  DashboardRevealAgentArgs,
  DashboardSnapshot
} from '../../../shared/agent-status/presentation/dashboard-snapshot'
import type {
  TerminalPreviewConnection,
  TerminalPreviewConnectOptions,
  TerminalPreviewConnectResult,
  TerminalPreviewDataPayload
} from '../../../shared/terminal/replay/terminal-preview'

export type DashboardApi = {
  openPopout: () => Promise<void>
  publishSnapshot: (snapshot: DashboardSnapshot) => Promise<void>
  getPopoutOpen: () => Promise<boolean>
  onPopoutOpenChanged: (callback: (open: boolean) => void) => () => void
  onSnapshotRequested: (callback: () => void) => () => void
  onRevealAgent: (callback: (args: DashboardRevealAgentArgs) => void) => () => void
  /** `explicit` only for a click on the card; watching an open dialog is a view. */
  onAckAgent: (callback: (paneKey: string, intent: 'view' | 'explicit') => void) => () => void
  requestSnapshot: () => Promise<void>
  onSnapshot: (callback: (snapshot: DashboardSnapshot) => void) => () => void
  revealAgent: (args: DashboardRevealAgentArgs) => Promise<void>
  ackAgent: (paneKey: string, intent: 'view' | 'explicit') => Promise<void>
}

export type TerminalPreviewApi = {
  connect: (
    ptyId: string,
    opts?: TerminalPreviewConnectOptions
  ) => Promise<TerminalPreviewConnectResult>
  input: (ptyId: string, data: string, connection?: TerminalPreviewConnection) => Promise<boolean>
  /** Claims the PTY grid; returns the size actually in effect. */
  fit: (
    ptyId: string,
    cols: number,
    rows: number,
    connection?: TerminalPreviewConnection,
    intent?: 'passive' | 'claim'
  ) => Promise<{ cols: number; rows: number } | null>
  ack: (ptyId: string, bytes: number, connection?: TerminalPreviewConnection) => Promise<void>
  unsubscribe: (ptyId: string, connection?: TerminalPreviewConnection) => Promise<void>
  onData: (callback: (payload: TerminalPreviewDataPayload) => void) => () => void
}
