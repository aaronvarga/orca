import { expect, it, vi } from 'vitest'
import '../../orca-runtime-tests/orca-runtime-test-lifecycle.spec'
import { identityFixture } from '../../terminal/query/terminal-identity.test-fixture'
import { TEST_WORKTREE_ID, store } from '../../orca-runtime-tests/orca-runtime-test-fixtures.spec'
import { partialRuntimeStore } from '../../orca-runtime-tests/runtime-store-partial-fixture'
import { getDefaultWorkspaceSession } from '../../../../shared/orca-profiles/constants'

it('refuses a session confirmation captured for a replaced incarnation', async () => {
  const f = identityFixture()
  f.add('pty', 'term')
  f.stamp('term', 'pty')
  f.owner.source.setPtyIncarnationId(f.owner.ptysById.get('pty')!, 'replacement')
  const kill = vi.fn(() => true)
  const killFenced = vi.fn(async () => ({ outcome: 'ended' as const }))
  f.runtime.setPtyController({
    write: () => true,
    kill,
    killFenced,
    getForegroundProcess: async () => null
  })
  await expect(f.runtime.closeTerminal('term', 'original')).rejects.toThrow(
    'terminal_incarnation_changed'
  )
  expect(kill).not.toHaveBeenCalled()
  expect(killFenced).not.toHaveBeenCalled()
})

it('ends only the confirmed process through the provider incarnation fence', async () => {
  const f = identityFixture()
  f.add('pty', 'term')
  f.stamp('term', 'pty')
  f.owner.source.setPtyIncarnationId(f.owner.ptysById.get('pty')!, 'original')
  const kill = vi.fn(() => true)
  const killFenced = vi.fn(async () => ({ outcome: 'ended' as const }))
  f.runtime.setPtyController({
    write: () => true,
    kill,
    killFenced,
    getForegroundProcess: async () => null
  })
  await expect(f.runtime.closeTerminal('term', 'original')).resolves.toMatchObject({
    ptyKilled: true
  })
  expect(killFenced).toHaveBeenCalledWith(
    {
      id: 'pty',
      expectedIncarnationId: 'original',
      requireNoAgentOwner: false,
      requireUnattached: false
    },
    expect.any(Function)
  )
  expect(kill).not.toHaveBeenCalled()
})

it('refuses a newly pinned session after provider startup unless the pin was explicitly confirmed', async () => {
  const saved = getDefaultWorkspaceSession()
  saved.tabsByWorktree[TEST_WORKTREE_ID] = [
    {
      id: 'pty:pty',
      ptyId: 'pty',
      worktreeId: TEST_WORKTREE_ID,
      title: 'Terminal',
      customTitle: null,
      color: null,
      sortOrder: 0,
      createdAt: 0
    }
  ]
  const f = identityFixture(
    undefined,
    partialRuntimeStore({ ...store, getWorkspaceSession: () => saved })
  )
  f.add('pty', 'term')
  f.stamp('term', 'pty')
  f.owner.source.setPtyIncarnationId(f.owner.ptysById.get('pty')!, 'original')
  const runtime = f.runtime
  const handle = 'term'
  let resume!: () => void
  const ready = new Promise<void>((resolve) => {
    resume = resolve
  })
  const stopped: string[] = []
  runtime.setPtyController({
    write: () => true,
    kill: () => true,
    getForegroundProcess: async () => null,
    killFenced: async (request, beforeKill) => {
      await ready
      beforeKill?.()
      stopped.push(request.expectedIncarnationId)
      return { outcome: 'ended' }
    }
  })
  const close = runtime.closeTerminal(handle, 'original')
  saved.tabsByWorktree[TEST_WORKTREE_ID]![0]!.isPinned = true
  resume()
  await expect(close).rejects.toThrow('terminal_tab_pinned')
  expect(stopped).toEqual([])
  await expect(runtime.closeTerminal(handle, 'original', true)).resolves.toMatchObject({
    ptyKilled: true
  })
  expect(stopped).toEqual(['original'])
})
