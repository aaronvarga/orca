import { useState } from 'react'
import { defineFixture } from '../../component-fixtures/component-fixture'
import { FolderGroupBrowserButton } from './FolderGroupBrowser'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'

const group: ProjectGroup = {
  id: 'clients',
  name: 'Clients',
  parentPath: '/clients',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

function ExpandedGroup() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="h-80 bg-worktree-sidebar p-3 text-worktree-sidebar-foreground">
      <div
        role="button"
        tabIndex={0}
        aria-label="Clients group"
        aria-expanded={!collapsed}
        className="flex w-56 items-center gap-1.5 text-sm font-semibold"
        onClick={() => setCollapsed(!collapsed)}
      >
        <FolderGroupBrowserButton group={group} />
        Clients
      </div>
    </div>
  )
}

export const expanded = defineFixture({
  width: 640,
  store: { projectGroups: [group], sidebarOpen: true },
  setup: () => {
    window.api.fs.readDir = async () => [
      { name: 'Acme', isDirectory: true, isSymlink: false },
      { name: 'Tapestry', isDirectory: true, isSymlink: false }
    ]
  },
  render: () => <ExpandedGroup />,
  interact: async (frame) => {
    frame.querySelector<HTMLButtonElement>('[aria-label="Browse Clients"]')?.click()
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
    const refresh = frame.ownerDocument.querySelector<HTMLButtonElement>(
      '[aria-label="Refresh folders"]'
    )
    if (!refresh) {
      throw new Error('Expanded folder groups must open the folder picker')
    }
    refresh.click()
    if (
      frame.querySelector('[aria-label="Clients group"]')?.getAttribute('aria-expanded') !== 'true'
    ) {
      throw new Error('Using the folder picker must not collapse its project group')
    }
  }
})
