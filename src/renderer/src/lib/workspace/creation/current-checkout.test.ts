import { describe, expect, it } from 'vitest'
import { resolveCurrentCheckout } from './current-checkout'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'

describe('resolveCurrentCheckout', () => {
  it('opens an imported linked checkout without changing the primary checkout or dirty metadata', () => {
    const primary = makeWorktree({
      id: 'repo::/repo',
      repoId: 'repo',
      path: '/repo',
      branch: 'main',
      isMainWorktree: true
    })
    const linked = makeWorktree({
      id: 'repo::/linked',
      repoId: 'repo',
      path: '/linked',
      branch: 'feature',
      isMainWorktree: false
    })
    const catalog = [primary, linked]
    expect(resolveCurrentCheckout(catalog, { id: 'repo', path: '/linked' }, 'local')).toBe(linked)
    expect(catalog.map(({ path, branch }) => [path, branch])).toEqual([
      ['/repo', 'main'],
      ['/linked', 'feature']
    ])
  })

  it('keeps colliding checkout identities on their captured host and refuses a missing checkout', () => {
    const local = makeWorktree({
      id: 'repo::/repo',
      repoId: 'repo',
      path: '/repo',
      hostId: 'local'
    })
    const remote = makeWorktree({
      id: 'repo::/repo',
      repoId: 'repo',
      path: '/repo',
      hostId: 'ssh:box'
    })
    expect(resolveCurrentCheckout([local, remote], { id: 'repo', path: '/repo' }, 'ssh:box')).toBe(
      remote
    )
    expect(
      resolveCurrentCheckout([local, remote], { id: 'repo', path: '/missing' }, 'ssh:box')
    ).toBeNull()
  })
})
