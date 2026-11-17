import { expect, it } from 'vitest'
import { parseAzureDevOpsWorkItemUrl } from './work-item-url'
import { normalizeAzureDevOpsCollectionUrl } from './connection-url'
import {
  getWorkspaceReferenceIdentity,
  parseWorkspaceReferenceUrl
} from '../workspace-attachments/workspace-reference-identity'
import { normalizeWorkspaceLinkedItem } from '../workspace-attachments/workspace-linked-item'
import { normalizeStoredTaskSourceContext } from '../work-items/task-source-context'
import { isWorkspaceLinkedItemSourceContextMatch } from '../workspace-attachments/workspace-linked-item-source-context'

it('keeps organization-qualified work-item identity across aliases and different project URL spellings', () => {
  const first = parseWorkspaceReferenceUrl('https://dev.azure.com/alpha/Project/_workitems/edit/42')
  const legacy = parseWorkspaceReferenceUrl(
    'https://alpha.visualstudio.com/Project/_workitems/edit/42'
  )
  const other = parseWorkspaceReferenceUrl('https://dev.azure.com/beta/Project/_workitems/edit/42')
  expect(first).toEqual({
    provider: 'azure-devops',
    type: 'issue',
    number: 42,
    url: 'https://dev.azure.com/alpha/Project/_workitems/edit/42'
  })
  expect(getWorkspaceReferenceIdentity(first)).toBe(getWorkspaceReferenceIdentity(legacy))
  expect(getWorkspaceReferenceIdentity(first)).not.toBe(getWorkspaceReferenceIdentity(other))
  expect(
    parseAzureDevOpsWorkItemUrl('https://server.example/tfs/Collection/Project/_workitems/edit/9')
  ).toEqual({
    baseUrl: 'https://server.example/tfs/Collection',
    project: 'Project',
    id: 9,
    url: 'https://server.example/tfs/Collection/Project/_workitems/edit/9'
  })
})
it('round trips Azure linked items and binds collection, project and item to their source context', () => {
  const item = normalizeWorkspaceLinkedItem({
    provider: 'azure-devops',
    type: 'issue',
    number: 42,
    title: 'Task',
    url: 'https://dev.azure.com/alpha/project-id/_workitems/edit/42'
  })!
  const context = normalizeStoredTaskSourceContext({
    provider: 'azure-devops',
    projectId: 'orca-project',
    hostId: 'local',
    providerIdentity: {
      provider: 'azure-devops',
      connectionId: 'connection',
      baseUrl: 'https://alpha.visualstudio.com',
      projectId: 'project-id'
    }
  })!
  expect(context.projectId).toBe('orca-project')
  expect(context.providerIdentity).toEqual({
    provider: 'azure-devops',
    connectionId: 'connection',
    baseUrl: 'https://dev.azure.com/alpha',
    projectId: 'project-id',
    teamId: null
  })
  expect(isWorkspaceLinkedItemSourceContextMatch(item, context)).toBe(true)
  expect(
    isWorkspaceLinkedItemSourceContextMatch(
      { ...item, url: 'https://dev.azure.com/beta/project-id/_workitems/edit/42' },
      context
    )
  ).toBe(false)
  expect(isWorkspaceLinkedItemSourceContextMatch({ ...item, number: 99 }, context)).toBe(false)
  expect(
    isWorkspaceLinkedItemSourceContextMatch(
      { ...item, url: 'https://dev.azure.com/alpha/other-project/_workitems/edit/42' },
      context
    )
  ).toBe(false)
})
it.each([
  'https://name:password@dev.azure.com/org',
  'https://dev.azure.com/org?token=secret',
  'https://dev.azure.com/org#fragment',
  'file:///collection'
])('rejects unsafe collection URL %s', (url) => {
  expect(() => normalizeAzureDevOpsCollectionUrl(url)).toThrow()
})
