import { describe, expect, it } from 'vitest'
import { landingChatRows } from './landing-chat-rows'

describe('empty pane chat choices', () => {
  it('offers explicit chats even when the provider defaults to CLI, retaining the owning host', () => {
    expect(
      landingChatRows([
        { kind: 'chat', agent: 'codex', executionHostId: 'local' },
        { kind: 'cli', agent: 'claude', chat: true, executionHostId: 'runtime:host' },
        { kind: 'cli', agent: 'cursor', executionHostId: 'local' },
        { kind: 'terminal', agent: 'kimi', executionHostId: 'ssh:host' },
        { kind: 'chat-unavailable', agent: 'claude', reason: 'ssh', executionHostId: 'ssh:host' }
      ])
    ).toEqual([
      { kind: 'chat', agent: 'codex', executionHostId: 'local' },
      { kind: 'chat', agent: 'claude', executionHostId: 'runtime:host' }
    ])
  })
})
