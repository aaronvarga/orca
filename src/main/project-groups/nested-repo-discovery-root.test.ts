import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, it } from 'vitest'
import { gitExecFileAsync } from '../git/command-runner/git-exec-file'
import { scanNestedRepos } from './nested-repo-discovery'

let root: string | undefined

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true })
    root = undefined
  }
})

it('keeps a selected subfolder inside a parent repository eligible for a folder project', async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'orca-selected-folder-')))
  const parent = join(root, 'Clients')
  const selected = join(parent, 'Kelley Supply')
  const nested = join(selected, 'app')
  await mkdir(nested, { recursive: true })
  await gitExecFileAsync(['init', '--quiet'], { cwd: parent, hostGit: true })
  await gitExecFileAsync(['init', '--quiet'], { cwd: nested, hostGit: true })

  const scan = await scanNestedRepos({ path: selected })
  expect(scan.selectedPath).toBe(selected)
  expect(scan.selectedPathKind).toBe('non_git_folder')
  expect(scan.repos.map((repo) => repo.path)).toEqual([nested])
  expect((await scanNestedRepos({ path: parent })).selectedPathKind).toBe('git_repo')

  const alias = join(root, 'Clients alias')
  await symlink(parent, alias, process.platform === 'win32' ? 'junction' : 'dir')
  expect((await scanNestedRepos({ path: alias })).selectedPathKind).toBe('git_repo')
  expect((await scanNestedRepos({ path: join(alias, 'Kelley Supply') })).selectedPathKind).toBe(
    'non_git_folder'
  )
})
