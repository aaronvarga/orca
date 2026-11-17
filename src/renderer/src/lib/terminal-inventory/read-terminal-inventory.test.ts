import { beforeEach, expect, it, vi } from 'vitest'
import type { RuntimeTerminalListResult } from '../../../../shared/terminal/runtime/runtime-terminal-contracts'
import { TERMINAL_IDENTITY_FENCED_CLOSE_CAPABILITY } from '../../../../shared/terminal/runtime-policy/terminal-runtime-capabilities'
import { callHostRoute } from '@/runtime/rpc/calls/host-route-call'
import { isHostIdentityFenceCurrent } from '@/runtime/rpc/environment-revisions/host-identity-fence'
import { readTerminalInventory } from './read-terminal-inventory'

vi.mock('@/runtime/rpc/calls/host-route-call', () => ({ callHostRoute: vi.fn() }))
vi.mock('@/runtime/rpc/environment-revisions/host-identity-fence', () => ({
  captureHostIdentityFence: vi.fn(() => ({})),
  isHostIdentityFenceCurrent: vi.fn(() => true)
}))

const route = {
  target: { kind: 'environment' as const, environmentId: 'server' },
  at: 'local' as const
}
beforeEach(() => {
  vi.mocked(callHostRoute).mockReset()
  vi.mocked(isHostIdentityFenceCurrent).mockReturnValue(true)
})

it('requests complete coverage after a truncated census without placing terminals', async () => {
  const partial: RuntimeTerminalListResult = {
    terminals: [],
    totalCount: 450,
    truncated: true,
    hostScope: { hostIds: ['local'], omittedHostIds: [] }
  }
  vi.mocked(callHostRoute).mockImplementation(async (_route, method, params) => {
    if (method === 'status.get') {
      return { capabilities: [TERMINAL_IDENTITY_FENCED_CLOSE_CAPABILITY] }
    }
    expect(params).toMatchObject({
      placeUnshownLiveTerminals: false,
      includePreview: false,
      includeVisualLayouts: false,
      requireFreshPtyLiveness: true
    })
    return params && typeof params === 'object' && 'limit' in params && params.limit === 450
      ? { ...partial, totalCount: 0, truncated: false }
      : partial
  })
  await expect(readTerminalInventory(route)).resolves.toMatchObject({
    totalCount: 0,
    truncated: false
  })
})

it('rejects an otherwise complete census after its host connection or pairing changed', async () => {
  vi.mocked(callHostRoute).mockImplementation(async (_route, method) =>
    method === 'status.get'
      ? { capabilities: [TERMINAL_IDENTITY_FENCED_CLOSE_CAPABILITY] }
      : {
          terminals: [],
          totalCount: 0,
          truncated: false,
          hostScope: { hostIds: ['local'], omittedHostIds: [] }
        }
  )
  vi.mocked(isHostIdentityFenceCurrent).mockReturnValue(false)
  await expect(readTerminalInventory(route)).rejects.toThrow('The terminal owner changed.')
})
