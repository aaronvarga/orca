import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { AgentSessionFavorites } from './AgentSessionFavorites'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { TabSessionFavoriteMenuItem } from '@/components/tab-bar/session-actions/TabSessionFavoriteMenuItem'

export const saved = defineFixture({
  width: 320,
  store: {
    settings: {
      ...getDefaultSettings('/fixture-home'),
      agentSessionFavorites: [
        {
          executionHostId: 'local',
          agent: 'claude',
          sessionId: 'meeting',
          title: 'Kelley Supply meeting notes',
          cwd: '/Work/Clients/Kelley Supply',
          structuredSession: { sessionId: 'meeting', workspaceId: 'folder:kelley' }
        },
        {
          executionHostId: 'local',
          agent: 'codex',
          sessionId: 'review',
          title: 'Review the database migration and deployment configuration',
          cwd: '/Dev/Project',
          workspaceId: 'project'
        }
      ]
    }
  },
  render: () => (
    <div className="bg-sidebar text-sidebar-foreground">
      <AgentSessionFavorites onOpen={() => undefined} />
    </div>
  )
})

export const tabMenu = defineFixture({
  width: 320,
  store: {
    unifiedTabsByWorktree: {
      'folder:kelley': [
        {
          id: 'meeting-tab',
          entityId: 'meeting',
          groupId: 'main',
          worktreeId: 'folder:kelley',
          executionHostId: 'local',
          contentType: 'agent-session',
          label: 'Kelley Supply meeting notes',
          customLabel: null,
          color: null,
          sortOrder: 0,
          createdAt: 1
        }
      ]
    }
  },
  render: () => (
    <div className="h-32 bg-sidebar text-sidebar-foreground">
      <ContextMenu>
        <ContextMenuTrigger>Session tab</ContextMenuTrigger>
        <ContextMenuContent>
          <TabSessionFavoriteMenuItem
            tab={{ id: 'meeting-tab', worktreeId: 'folder:kelley' }}
            nativeChat={{ sessionId: 'meeting', agent: 'claude' }}
          />
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
  interact: (frame) => {
    frame
      .querySelector('[data-slot="context-menu-trigger"]')!
      .dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, button: 2, clientX: 60, clientY: 20 })
      )
  }
})
