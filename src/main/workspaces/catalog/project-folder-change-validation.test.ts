import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import type { Repo } from '../../../shared/repository/repo-types'
import type { ProjectHostSetup } from '../../../shared/project/project-types'
import { gitExecFileAsync } from '../../git/command-runner/git-exec-file'
import { validateProjectFolderChange } from './project-folder-change-validation'

let root: string | undefined
afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true })
  }
})

it('accepts a plain subfolder of a Git repository and rejects it for a Git project', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-repoint-validation-')))
  const destination = join(root, 'Kelley Supply')
  await mkdir(destination)
  await gitExecFileAsync(['init', '--quiet'], { cwd: root, hostGit: true })
  const repo: Repo = {
    id: 'project',
    path: '/old/location',
    kind: 'folder',
    displayName: 'Kelley Supply',
    badgeColor: 'gray',
    addedAt: 1
  }
  const setup: ProjectHostSetup = {
    id: 'project',
    projectId: 'repo:project',
    repoId: 'project',
    hostId: 'local',
    path: repo.path,
    displayName: repo.displayName,
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 1,
    updatedAt: 1
  }
  const store = { getRepos: () => [repo], getProjectHostSetups: () => [setup] }
  const args = { setupId: 'project', updates: { path: destination } }
  const recheck = await validateProjectFolderChange(store, args)
  expect(recheck()).toBeUndefined()
  repo.kind = 'git'
  await expect(validateProjectFolderChange(store, args)).rejects.toThrow(
    'top folder of a Git repository'
  )
  await expect(
    validateProjectFolderChange(store, { ...args, updates: { path: join(root, 'missing') } })
  ).rejects.toThrow('existing folder')
  await validateProjectFolderChange(store, {
    ...args,
    updates: { path: destination, kind: 'folder' }
  })
  repo.kind = 'folder'
  const stale = await validateProjectFolderChange(store, args)
  repo.path = '/concurrent/change'
  expect(stale).toThrow('project changed')
})
