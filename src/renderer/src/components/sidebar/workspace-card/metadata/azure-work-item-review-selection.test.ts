import { expect, it } from 'vitest'
import { makeWorktree } from '@/store/slices/worktrees/worktree.test-fixture'
import { getActiveWorkspaceReviewKey } from './worktree-attachment-editing'
it('keeps a work item out of same-number Azure pull-request selection', () => {
  const workspace = makeWorktree({
    id: 'workspace',
    repoId: 'repo',
    linkedAzureDevOpsPR: 42,
    linkedItems: [
      {
        provider: 'azure-devops',
        type: 'issue',
        number: 42,
        title: 'Work item',
        url: 'https://dev.azure.com/alpha/project/_workitems/edit/42'
      }
    ]
  })
  const selected = getActiveWorkspaceReviewKey(workspace)
  expect(selected).not.toBeNull()
  expect(JSON.parse(JSON.parse(selected!)[0])).toEqual(['azure-devops', 'pr', 42])
})
