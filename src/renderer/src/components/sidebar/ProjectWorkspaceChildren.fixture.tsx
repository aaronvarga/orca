import { defineFixture } from '../../component-fixtures/component-fixture'
import { buildLineageRowProjection } from './worktree-list/listing/lineage-row-projection'
import type { WorktreeRow } from '../../../../shared/sidebar-list/row-types'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import WorktreeCard from './workspace-card/surface/WorktreeCard'
import {
  FIXTURE_REPO,
  makeWorktree,
  seedWorkspaces,
  type WorkspaceSeed
} from './worktree-card-slot-fixture-seeds'

const now = Date.now()
const seeds: WorkspaceSeed[] = [
  {
    id: 'develop',
    name: 'develop',
    agents: [{ agentType: 'claude', state: 'working', minutesAgo: 1, toolName: 'Read' }]
  },
  {
    id: 'feature',
    name: 'feature/web-ui',
    agents: [
      { agentType: 'codex', state: 'blocked', minutesAgo: 2, prompt: 'Review the project UI' }
    ]
  }
]
const items: WorktreeRow[] = seeds.map((seed) => ({
  type: 'item',
  rowKey: seed.id,
  sectionKey: FIXTURE_REPO.id,
  worktree: makeWorktree(seed, now),
  repo: FIXTURE_REPO,
  depth: 0,
  groupDepth: 0,
  isLastLineageChild: true,
  lineageChildCount: 0
}))
const { frames } = buildLineageRowProjection(items, 'repo', true)

export const projectChildren = defineFixture({
  width: 320,
  setup: () => seedWorkspaces(seeds, now),
  render: () => (
    <div className="bg-worktree-sidebar py-2 text-worktree-sidebar-foreground">
      <div className="flex items-center gap-2 px-2.5 py-2 text-sm font-semibold">
        <RepoIconGlyph repoIcon={FIXTURE_REPO.repoIcon} className="size-4" iconClassName="size-4" />
        {FIXTURE_REPO.displayName}
      </div>
      {items.map((item, index) => (
        <div key={item.rowKey} style={{ paddingLeft: frames[index].left }}>
          <WorktreeCard
            worktree={item.worktree}
            repo={FIXTURE_REPO}
            isActive={index === 0}
            flushSurface
            hideRepoBadge
            contentIndent={frames[index].contentIndent}
            nativeDragEnabled={false}
          />
        </div>
      ))}
    </div>
  )
})
