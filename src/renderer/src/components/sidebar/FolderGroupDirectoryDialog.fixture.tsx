import { defineFixture } from '../../component-fixtures/component-fixture'
import { FolderGroupDirectoryDialog } from './FolderGroupDirectoryDialog'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'

const group: ProjectGroup = {
  id: 'clients',
  name: 'Clients',
  parentPath: '/Users/aaron/Clients',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}
export const edit = defineFixture({
  width: 640,
  render: () => (
    <div className="h-96">
      <FolderGroupDirectoryDialog hostId="local" group={group} onClose={() => {}} />
    </div>
  )
})
export const narrow = defineFixture({
  width: 360,
  render: () => (
    <div className="h-96">
      <FolderGroupDirectoryDialog hostId="local" group={group} onClose={() => {}} />
    </div>
  )
})
export const create = defineFixture({
  width: 640,
  render: () => (
    <div className="h-128">
      <FolderGroupDirectoryDialog hostId="local" onClose={() => {}} />
    </div>
  )
})
