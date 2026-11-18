import type { TuiAgent } from '../../agent-launch/catalog/tui-agent'

export type TerminalQuickCommandScope =
  | {
      type: 'global'
    }
  | {
      type: 'repo'
      repoId: string
    }

export type TerminalQuickCommandAction = 'terminal-command' | 'agent-prompt'

export type TerminalQuickCommandBase = {
  id: string
  label: string
  scope?: TerminalQuickCommandScope
  /** False inserts into the current input without submitting; omitted preserves legacy entry-point behavior. */
  newSession?: boolean
}

export type TerminalCommandQuickCommand = TerminalQuickCommandBase & {
  action?: 'terminal-command'
  command: string
  appendEnter: boolean
}

export type TerminalAgentQuickCommand = TerminalQuickCommandBase & {
  action: 'agent-prompt'
  agent: TuiAgent
  prompt: string
}

export type TerminalQuickCommand = TerminalCommandQuickCommand | TerminalAgentQuickCommand
