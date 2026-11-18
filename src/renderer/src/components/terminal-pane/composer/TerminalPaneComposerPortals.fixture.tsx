import { useLayoutEffect, useRef, useState } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { PaneManager } from '@/lib/pane-manager/pane-manager'
import { TerminalPaneComposerPortals } from './TerminalPaneComposerPortals'
import '@xterm/xterm/css/xterm.css'

function TerminalWithComposer({ height = 320 }: { height?: number }) {
  const root = useRef<HTMLDivElement>(null)
  const [controller, setController] = useState<
    Parameters<typeof TerminalPaneComposerPortals>[0]['controller'] | null
  >(null)
  useLayoutEffect(() => {
    if (!root.current) {
      return
    }
    const manager = new PaneManager(root.current, {
      linkOpenHint: () => '',
      terminalGpuAcceleration: 'off'
    })
    const pane = manager.createInitialPane({ focus: false })
    pane.container.dataset.hasTitle = ''
    pane.terminal.write(`${'CLI output\r\n'.repeat(40)}CLI input stays visible > `)
    setController({
      managedPanes: [pane],
      worktreeId: 'fixture::/projects/fixture',
      tabId: 'fixture',
      effectiveChatViewMode: false,
      chatPane: null,
      paneTransportsRef: { current: new Map() },
      managerRef: { current: manager }
    })
    return () => manager.destroy()
  }, [])
  return (
    <div className="bg-background" style={{ height }}>
      <div ref={root} className="pane-manager-root" />
      {controller ? <TerminalPaneComposerPortals controller={controller} /> : null}
    </div>
  )
}

export const desktop = defineFixture({
  width: 640,
  render: () => <TerminalWithComposer />,
  interact: async (frame) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    const terminal = frame.querySelector<HTMLElement>('.xterm-container')
    const composer = frame.querySelector<HTMLElement>('[data-terminal-composer]')
    if (
      !terminal ||
      !composer ||
      terminal.getBoundingClientRect().bottom > composer.getBoundingClientRect().top ||
      (frame.querySelector('.xterm-screen')?.getBoundingClientRect().bottom ?? 0) >
        composer.getBoundingClientRect().top
    ) {
      throw new Error('The CLI viewport must end above the pane composer')
    }
  }
})

export const narrow = defineFixture({ ...desktop, width: 280 })

export const short = defineFixture({
  ...desktop,
  render: () => <TerminalWithComposer height={128} />
})
