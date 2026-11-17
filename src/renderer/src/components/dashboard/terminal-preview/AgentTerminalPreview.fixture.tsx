import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { TerminalPreviewDataPayload } from '../../../../../shared/terminal/replay/terminal-preview'
import { AgentTerminalPreview } from './AgentTerminalPreview'

export const commandCenter = defineFixture({
  width: 640,
  setup: () => {
    let cols = 500
    let rows = 60
    const listeners = new Set<(payload: TerminalPreviewDataPayload) => void>()
    window.api.terminalPreview = {
      connect: async () => ({
        snapshot: { data: '$ Ready for input\r\n', cols, rows },
        replay: []
      }),
      fit: async (ptyId, nextCols, nextRows, connection) => {
        cols = nextCols
        rows = nextRows
        for (const listener of listeners) {
          listener({ type: 'resync', ptyId, connection })
        }
        return { cols, rows }
      },
      onData: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      input: async () => true,
      ack: async () => {},
      unsubscribe: async () => {}
    }
    window.api.ui.readClipboardText = async () => ''
    window.api.ui.readClipboardFilePaths = async () => []
    window.api.ui.clipboardHasImage = async () => true
    window.api.ui.saveClipboardImageAsTempFile = async () => '/tmp/Pasted.png'
  },
  render: () => (
    <AgentTerminalPreview
      ptyId="fixture-preview"
      claimOnMount
      scaleToFit={false}
      linkSource={{
        worktreeId: 'fixture-workspace',
        executionHostId: 'local',
        tabId: 'fixture-tab',
        ptyId: 'fixture-preview'
      }}
      className="h-80"
    />
  )
})
