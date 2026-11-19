import { expect, it } from 'vitest'
import { findOrcaForkProject } from './orca-fork-project'
import type { Repo } from '../../../../shared/repository/repo-types'

const fork: Repo = {
  id: 'fork',
  path: '/projects/orca',
  displayName: 'Orca',
  badgeColor: '',
  addedAt: 0,
  gitRemoteIdentity: {
    canonicalKey: 'github.com/aaronvarga/orca',
    remoteName: 'origin',
    remoteUrl: 'https://github.com/aaronvarga/orca'
  }
}
it('targets the local fork instead of a remote twin or similarly named folder', () => {
  const remote: Repo = { ...fork, executionHostId: 'ssh:server' }
  const folder: Repo = { ...fork, id: 'folder', kind: 'folder' }
  expect(findOrcaForkProject([remote, folder, fork])?.id).toBe('fork')
  expect(findOrcaForkProject([remote, folder])).toBeNull()
})
it('refuses ambiguous checkouts and the upstream repository itself', () => {
  expect(findOrcaForkProject([fork, { ...fork, id: 'other', path: '/another/orca' }])).toBeNull()
  const upstream: Repo = {
    ...fork,
    gitRemoteIdentity: { ...fork.gitRemoteIdentity!, canonicalKey: 'github.com/stablyai/orca' }
  }
  expect(findOrcaForkProject([upstream])).toBeNull()
})

it('recognizes a fork whose provider grouping uses its upstream remote', () => {
  const groupedByUpstream: Repo = {
    ...fork,
    gitRemoteIdentity: {
      canonicalKey: 'github.com/stablyai/orca',
      remoteName: 'upstream',
      remoteUrl: 'https://github.com/stablyai/orca.git'
    },
    upstream: { host: 'github.com', owner: 'stablyai', repo: 'orca' }
  }
  expect(findOrcaForkProject([groupedByUpstream])?.id).toBe('fork')
})
