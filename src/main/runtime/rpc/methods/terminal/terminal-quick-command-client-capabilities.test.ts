import { expect, it } from 'vitest'
import {
  projectTerminalQuickCommandsForClient,
  assertTerminalQuickCommandMutationReadableForClient
} from './terminal-quick-command-client-capabilities'

it('prevents an older client from dropping the current-session choice on overwrite', () => {
  const commands = [
    {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt' as const,
      agent: 'claude' as const,
      prompt: 'Review this workspace',
      newSession: false
    }
  ]
  const reader = {
    clientKind: 'mobile' as const,
    clientCapabilities: [
      'terminal.quick-commands.long-prompts.v1',
      'terminal.quick-commands.large-lists.v1'
    ]
  }
  expect(projectTerminalQuickCommandsForClient(commands, reader)).toEqual([])
  expect(() =>
    assertTerminalQuickCommandMutationReadableForClient(
      commands,
      {
        type: 'upsert',
        command: {
          id: 'review',
          label: 'Review',
          action: 'agent-prompt',
          agent: 'claude',
          prompt: 'Overwrite from an older client'
        }
      },
      reader
    )
  ).toThrow('Update this Orca client to save this quick command.')
  expect(
    projectTerminalQuickCommandsForClient(commands, {
      clientKind: 'mobile',
      clientCapabilities: [
        'terminal.quick-commands.long-prompts.v1',
        'terminal.quick-commands.large-lists.v1',
        'terminal.quick-commands.session-target.v1'
      ]
    })
  ).toEqual([
    {
      id: 'review',
      label: 'Review',
      action: 'agent-prompt',
      agent: 'claude',
      prompt: 'Review this workspace',
      newSession: false
    }
  ])
})
