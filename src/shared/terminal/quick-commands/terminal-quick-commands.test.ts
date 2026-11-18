import { expect, it } from 'vitest'
import {
  assertTerminalQuickCommandSessionChoiceSaved,
  normalizeTerminalQuickCommands,
  parseNormalizedTerminalQuickCommands
} from './terminal-quick-commands'

it('retains current-session insertion in canonical saved commands and refuses an invalid flag', () => {
  const commands = normalizeTerminalQuickCommands([
    {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review the current workspace',
      newSession: false
    }
  ])
  expect(parseNormalizedTerminalQuickCommands(commands)).toEqual([
    {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review the current workspace',
      newSession: false,
      scope: { type: 'global' }
    }
  ])
  expect(
    parseNormalizedTerminalQuickCommands([
      {
        id: 'review',
        label: 'Review',
        action: 'agent-prompt',
        agent: 'claude',
        prompt: 'Review the current workspace',
        newSession: 'false',
        scope: { type: 'global' }
      }
    ])
  ).toBeNull()
})

it('refuses a stale host acknowledgement that dropped the selected session choice', () => {
  expect(() =>
    assertTerminalQuickCommandSessionChoiceSaved(
      [{ id: 'review', label: 'Review', command: 'inspect', appendEnter: true }],
      {
        type: 'upsert',
        command: {
          id: 'review',
          label: 'Review',
          command: 'inspect',
          appendEnter: true,
          newSession: false
        }
      }
    )
  ).toThrow('The session choice was not saved.')
})
