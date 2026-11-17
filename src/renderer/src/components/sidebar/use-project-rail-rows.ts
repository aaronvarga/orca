import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import {
  filterProjectGroupsForVisibleHosts,
  getVisibleSidebarHostIdSet
} from '../../../../shared/sidebar-list/hosts/host-filtering'
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useProjectHostSetupProjection } from '@/store/projects/use-project-host-setup-projection'
import { useDesktopSidebarFeed } from './sidebar-feed/desktop-sidebar-feed'
import { buildSidebarFeedRows } from '../../../../shared/sidebar-list/feed/sidebar-feed-rows'
import { EMPTY_SIDEBAR_FEED_DOMAINS } from '../../../../shared/sidebar-feed-client/sidebar-feed-snapshot'
import { NO_WORKSPACE_ROW_FILTERS } from '../../../../shared/workspace-view/workspace-row-filters'
import {
  getLocalExecutionHostLabel,
  getRepoExecutionHostId,
  getSettingsFocusedExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { getHostDisplayLabelOverrides } from '../../../../shared/execution-host/host-setting-overrides'
import type { Repo } from '../../../../shared/repository/repo-types'

export type ProjectRailRow =
  | { kind: 'repo'; repo: Repo; key: string; group: string }
  | { kind: 'folder-group'; projectGroup: ProjectGroup; key: string; group: string }

export function useProjectRailRows(): ProjectRailRow[] {
  const feed = useDesktopSidebarFeed()
  const projection = useProjectHostSetupProjection()
  const state = useAppStore(
    useShallow((s) => ({
      repos: s.repos,
      projectGroups: s.projectGroups,
      settings: s.settings,
      projectOrderBy: s.projectOrderBy,
      workspaceHostOrder: s.workspaceHostOrder,
      visibleWorkspaceHostIds: s.visibleWorkspaceHostIds,
      workspaceHostScope: s.workspaceHostScope
    }))
  )
  return useMemo(() => {
    const result = buildSidebarFeedRows(
      feed?.domains ?? EMPTY_SIDEBAR_FEED_DOMAINS,
      {
        repos: state.repos,
        projectGroups: state.projectGroups,
        projectGrouping: { projects: projection.projects, projectHostSetups: projection.setups }
      },
      {
        groupBy: 'repo',
        sortBy: 'manual',
        projectOrderBy: state.projectOrderBy,
        collapsedGroups: new Set(),
        filters: NO_WORKSPACE_ROW_FILTERS,
        workspaceHostScope: state.workspaceHostScope,
        visibleWorkspaceHostIds: state.visibleWorkspaceHostIds,
        workspaceStatuses: [],
        pinnedDisplayPolicy: 'single-location',
        defaultHostId: getSettingsFocusedExecutionHostId(state.settings),
        hostLabelOverrides: getHostDisplayLabelOverrides(state.settings),
        localHostLabel: getLocalExecutionHostLabel(),
        workspaceHostOrder: state.workspaceHostOrder
      }
    )
    const seen = new Set<string>()
    return result.sectionRows.flatMap<ProjectRailRow>((row) => {
      if (row.type !== 'header') {
        return []
      }
      if (!row.repo) {
        if (!row.projectGroup?.id) {
          return []
        }
        return filterProjectGroupsForVisibleHosts(
          state.projectGroups,
          getVisibleSidebarHostIdSet(state.visibleWorkspaceHostIds, state.workspaceHostScope),
          getSettingsFocusedExecutionHostId(state.settings)
        )
          .filter((group) => group.id === row.projectGroup?.id && group.parentPath)
          .flatMap((group) => {
            const key = JSON.stringify(['folder-group', getRepoExecutionHostId(group), group.id])
            if (seen.has(key)) {
              return []
            }
            seen.add(key)
            return [{ kind: 'folder-group', projectGroup: group, key, group: group.id }]
          })
      }
      const repos = row.hostRepos ? [...row.hostRepos.values()] : [row.repo]
      return repos.flatMap((repo) => {
        const key = JSON.stringify([getRepoExecutionHostId(repo), repo.id])
        if (seen.has(key)) {
          return []
        }
        seen.add(key)
        return [{ kind: 'repo' as const, repo, key, group: repo.projectGroupId ?? '' }]
      })
    })
  }, [feed, projection, state])
}
