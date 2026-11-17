import { describe, expect, it } from 'vitest'
import type {
  RuntimeTerminalListResult,
  RuntimeTerminalSummary
} from '../../../../shared/terminal/runtime/runtime-terminal-contracts'
import { reconcileTerminalInventory } from './terminal-inventory-state'

const local = { target: { kind: 'local' as const }, at: 'local' as const }
const remote = {
  target: { kind: 'environment' as const, environmentId: 'server' },
  at: 'local' as const
}
const terminal: RuntimeTerminalSummary = {
  handle: 'handle',
  ptyId: 'pty',
  incarnationId: 'first',
  worktreeId: 'repo::/repo',
  worktreePath: '/repo',
  branch: 'main',
  tabId: 'tab',
  leafId: 'terminal-1',
  title: null,
  connected: true,
  writable: true,
  lastOutputAt: null,
  preview: '',
  executionHostId: 'local',
  verdict: 'live'
}
const census = (
  terminals: RuntimeTerminalSummary[],
  patch: Partial<RuntimeTerminalListResult> = {}
): RuntimeTerminalListResult => ({
  terminals,
  totalCount: terminals.length,
  truncated: false,
  hostScope: { hostIds: ['local'], omittedHostIds: [] },
  ...patch
})

describe('terminal inventory admission and retirement', () => {
  it('keeps colliding local and endpoint-relative remote processes distinct', () => {
    const first = reconcileTerminalInventory([], local, census([terminal]))
    const both = reconcileTerminalInventory(first, remote, census([terminal]))
    expect(both.map(({ ownerId, available }) => [ownerId, available])).toEqual([
      ['local', true],
      ['runtime:server', true]
    ])
    const remoteEmpty = reconcileTerminalInventory(both, remote, census([]))
    expect(remoteEmpty.map(({ ownerId }) => ownerId)).toEqual(['local'])
  })

  it('does not admit saved panes, or a legacy PTY as a writable running terminal', () => {
    const sessions = reconcileTerminalInventory(
      [],
      local,
      census([
        { ...terminal, ptyId: null },
        { ...terminal, incarnationId: undefined, verdict: undefined }
      ])
    )
    expect(sessions.map(({ terminal: row, available }) => [row.ptyId, available])).toEqual([
      ['pty', false]
    ])
  })

  it('keeps raw legacy SSH bridge sessions unavailable while endpoint-owned SSH servers stay live', () => {
    const legacy = reconcileTerminalInventory(
      [],
      local,
      census([{ ...terminal, executionHostId: 'ssh:target' }], {
        hostScope: { hostIds: ['ssh:target'], omittedHostIds: [] }
      })
    )
    expect(legacy.map(({ ownerId, available }) => [ownerId, available])).toEqual([
      ['ssh:target', false]
    ])
    const hosted = reconcileTerminalInventory([], remote, census([terminal]))
    expect(hosted.map(({ ownerId, available }) => [ownerId, available])).toEqual([
      ['runtime:server', true]
    ])
  })

  it('retains unavailable processes through failed, truncated and uncovered censuses', () => {
    const initial = reconcileTerminalInventory([], local, census([terminal]))
    for (const result of [
      null,
      census([], { truncated: true, totalCount: 500 }),
      census([], { hostScope: { hostIds: [], omittedHostIds: ['local'] } })
    ]) {
      const retained = reconcileTerminalInventory(initial, local, result)
      expect(
        retained.map(({ terminal: row, available }) => [row.incarnationId, available])
      ).toEqual([['first', false]])
    }
  })

  it('retires only confirmed exits or absence from complete owner coverage', () => {
    const initial = reconcileTerminalInventory([], local, census([terminal]))
    expect(reconcileTerminalInventory(initial, local, census([]))).toEqual([])
    expect(
      reconcileTerminalInventory(
        initial,
        local,
        census([{ ...terminal, verdict: 'exited' }], { truncated: true })
      )
    ).toEqual([])
    const replaced = reconcileTerminalInventory(
      initial,
      local,
      census([{ ...terminal, incarnationId: 'second' }])
    )
    expect(replaced.map(({ terminal: row }) => row.incarnationId)).toEqual(['second'])
    expect(replaced[0]?.id).not.toBe(initial[0]?.id)
  })
})
