import { afterEach, expect, it, vi } from 'vitest'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { persistProjectGroupUpdate } from './project-group-update-persistence'

afterEach(() => vi.unstubAllGlobals())

it('refuses to confirm a root change when an older host returns the original root', async () => {
  const original: ProjectGroup = {
    id: 'group',
    name: 'Clients',
    parentPath: '/original',
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1
  }
  const update = vi.fn(async () => original)
  vi.stubGlobal('window', { api: { projectGroups: { update } } })
  expect(
    await persistProjectGroupUpdate({ kind: 'local' }, 'group', { parentPath: '/replacement' })
  ).toBeNull()
  update.mockResolvedValue({ ...original, parentPath: '/replacement' })
  expect(
    await persistProjectGroupUpdate({ kind: 'local' }, 'group', { parentPath: '/replacement' })
  ).toMatchObject({ id: 'group', parentPath: '/replacement' })
})
