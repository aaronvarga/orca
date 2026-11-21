import { expect, it } from 'vitest'
import { resolveFavoriteAgentSession } from './resolve-favorite-agent-session'
import { recordedSession } from '../accounts/ai-vault-account-test-fixture'

it('reopens an older favorite from its owning host with fresh history metadata', async () => {
  const remote = { ...recordedSession('claude'), executionHostId: 'runtime:server-a' as const }
  const otherHost = { ...remote, executionHostId: 'local' as const }
  const favorite = {
    ...remote,
    title: 'Saved earlier',
    cwd: '/plain-folder'
  }
  let request: unknown
  const result = await resolveFavoriteAgentSession(favorite, async (args) => {
    request = args
    return { sessions: [otherHost, remote], issues: [], scannedAt: '2026-11-19T00:00:00Z' }
  })
  expect(request).toEqual({
    executionHostScope: 'runtime:server-a',
    unlimited: true,
    scopePaths: ['/plain-folder'],
    scopeOnly: true
  })
  expect(result).toBe(remote)
})

it('retains the bookmarked transcript when the same conversation exists in two account homes', async () => {
  const session = recordedSession('claude')
  const otherAccount = { ...session, filePath: '/other-account/conversation.jsonl' }
  const favorite = { ...session, cwd: '/plain-folder' }
  const list = async () => ({
    sessions: [otherAccount, session],
    issues: [],
    scannedAt: '2026-11-19T00:00:00Z'
  })
  expect(await resolveFavoriteAgentSession(favorite, list)).toBe(session)
  expect(await resolveFavoriteAgentSession({ ...favorite, filePath: undefined }, list)).toBeNull()
})
