import { useState } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { TerminalQuickCommandDialog } from './TerminalQuickCommandDialog'
import type { TerminalQuickCommand } from '../../../../shared/terminal/quick-commands/terminal-quick-command-types'

function QuickCommand({ newSession = false }: { newSession?: boolean }) {
  const [saved, setSaved] = useState<TerminalQuickCommand | null>(null)
  return (
    <>
      <output aria-label="Saved command">{saved ? JSON.stringify(saved) : ''}</output>
      <TerminalQuickCommandDialog
        open
        mode="add"
        command={{
          id: 'review',
          label: 'Review current workspace',
          action: 'agent-prompt',
          agent: 'claude',
          prompt: 'Review the current workspace and preserve existing changes.',
          newSession
        }}
        onOpenChange={() => {}}
        onSave={(command) => {
          setSaved(command)
          return false
        }}
      />
    </>
  )
}

export const current = defineFixture({ width: 960, render: () => <QuickCommand /> })
export const newSession = defineFixture({ width: 960, render: () => <QuickCommand newSession /> })
export const narrow = defineFixture({ width: 360, render: () => <QuickCommand /> })
