import type { DashboardCardTerminalInput } from '../../../../../shared/agent-status/presentation/dashboard-snapshot'
import type { DashboardPreviewLinkSource } from './links/dashboard-preview-http-actions'

export type TerminalPreviewProps = {
  composerSessionKey?: string
  ptyId: string
  viewerId?: string
  incarnationId?: string
  interactive?: boolean
  claimOnMount?: boolean
  scaleToFit?: boolean
  /** Host-input facts relayed with the card; null routes bytes by client OS. */
  terminalInput?: DashboardCardTerminalInput | null
  className?: string
  onRequestClose?: () => void
  linkSource?: DashboardPreviewLinkSource
  onBrowserForeground?: () => void
}
