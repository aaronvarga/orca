import { ipcRenderer } from 'electron'
import type {
  TerminalPreviewConnection,
  TerminalPreviewConnectOptions,
  TerminalPreviewConnectResult,
  TerminalPreviewDataPayload
} from '../../../shared/terminal/replay/terminal-preview'
import type { PreloadApi } from '../../api-types'

export const terminalPreviewApi = {
  connect: (
    ptyId: string,
    opts?: TerminalPreviewConnectOptions
  ): Promise<TerminalPreviewConnectResult> =>
    ipcRenderer.invoke('terminalPreview:connect', { ptyId, opts }),
  input: (ptyId: string, data: string, connection?: TerminalPreviewConnection): Promise<boolean> =>
    ipcRenderer.invoke('terminalPreview:input', { ptyId, data, connection }),
  fit: (
    ptyId: string,
    cols: number,
    rows: number,
    connection?: TerminalPreviewConnection,
    intent?: 'passive' | 'claim'
  ): Promise<{ cols: number; rows: number } | null> =>
    ipcRenderer.invoke('terminalPreview:fit', { ptyId, cols, rows, connection, intent }),
  ack: (ptyId: string, bytes: number, connection?: TerminalPreviewConnection): Promise<void> =>
    ipcRenderer.invoke('terminalPreview:ack', { ptyId, bytes, connection }),
  unsubscribe: (ptyId: string, connection?: TerminalPreviewConnection): Promise<void> =>
    ipcRenderer.invoke('terminalPreview:unsubscribe', { ptyId, connection }),
  onData: (callback: (payload: TerminalPreviewDataPayload) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: TerminalPreviewDataPayload
    ): void => callback(payload)
    ipcRenderer.on('terminalPreview:data', listener)
    return () => ipcRenderer.removeListener('terminalPreview:data', listener)
  }
} satisfies PreloadApi['terminalPreview']
