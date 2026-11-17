import { defineFixture } from '../../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import type {
  AzureDevOpsConnection,
  AzureDevOpsWorkItem
} from '../../../../../shared/azure-devops/boards-types'
import { TaskPageAzureDevOpsContent } from './Content'
import { emptySelection } from './azure-task-selection'

const connection: AzureDevOpsConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Contoso',
  baseUrl: 'https://dev.azure.com/contoso',
  viewer: { id: 'viewer', displayName: 'Alex Morgan' },
  revision: '33333333-3333-4333-8333-333333333333'
}
const project = { id: '22222222-2222-4222-8222-222222222222', name: 'Customer Portal' }
const item: AzureDevOpsWorkItem = {
  id: 42,
  title: 'Keep customer filters when returning from details',
  project,
  type: 'User Story',
  state: 'Active',
  assignee: 'Alex Morgan',
  updatedAt: '2026-11-17T15:20:00Z',
  url: `https://dev.azure.com/contoso/${project.id}/_workitems/edit/42`,
  tags: 'accessibility; navigation',
  area: 'Customer Portal\\Web',
  iteration: 'Customer Portal\\Sprint 12',
  description:
    '<p>Customers need to return to the same filtered list after inspecting a record.</p><ul><li>Preserve the selected state and owner.</li><li>Keep keyboard focus on the inspected row.</li></ul><img src="https://track.example/pixel"><script>alert(1)</script>',
  acceptanceCriteria:
    '<p><strong>Given</strong> a filtered list, returning from details restores the selected filters.</p>',
  related: []
}
function Surface(): React.JSX.Element {
  const pageData = useAppStore((state) => state.taskPageData)
  return (
    <div className="min-h-[900px] bg-background p-5 text-foreground">
      <TaskPageAzureDevOpsContent
        model={{
          accountBackedTaskSourceHostId: 'local',
          fallbackTaskSourceProjectId: 'orca-project',
          pageData,
          hostLabelById: new Map([['local', 'Local Mac']]),
          openModal: useAppStore.getState().openModal
        }}
      />
    </div>
  )
}
function fixture(state: 'setup' | 'list' | 'detail' | 'query' | 'error' | 'capped', width = 1100) {
  return defineFixture({
    width,
    store: { activeOrcaProfileId: 'azure-fixture' },
    setup: () => {
      localStorage.setItem(
        'orca.azure-boards.v1:azure-fixture:local',
        JSON.stringify({
          ...emptySelection,
          connectionId: connection.id,
          projectId: project.id,
          detailId: state === 'detail' ? 42 : null,
          view: state === 'query' ? 'query' : 'assigned',
          queryId: state === 'query' ? '44444444-4444-4444-8444-444444444444' : ''
        })
      )
      window.api.azureDevOps = {
        cancelRead: async () => {},
        status: async () => ({
          connections: state === 'setup' ? [] : [connection],
          credentialProtection: null
        }),
        connect: async () => connection,
        disconnect: async () => {},
        testConnection: async () => connection.viewer,
        listProjects: async () => [project],
        listTeams: async () => [
          { id: '55555555-5555-4555-8555-555555555555', name: 'Portal Team' }
        ],
        listQueries: async () => [
          {
            id: '44444444-4444-4444-8444-444444444444',
            name: 'Active customer stories',
            queryType: 'flat'
          }
        ],
        metadata: async () => ({
          types: ['User Story', 'Bug'],
          states: ['New', 'Active', 'Closed']
        }),
        queryWorkItems: async () => {
          if (state === 'error') {
            throw new Error(
              'Azure DevOps request failed: HTTP 403 (Work Items Read permission required)'
            )
          }
          return {
            items: [
              item,
              {
                ...item,
                id: 58,
                title: 'Improve sign-in recovery',
                type: 'Bug',
                state: 'New',
                assignee: 'Jamie Chen'
              }
            ],
            capped: state === 'capped',
            omittedIds: state === 'capped' ? [66] : []
          }
        },
        getWorkItem: async () => item
      }
    },
    render: () => <Surface />
  })
}
export const setup = fixture('setup')
export const list = fixture('list')
export const detail = fixture('detail')
export const query = fixture('query')
export const error = fixture('error')
export const capped = fixture('capped')
export const listNarrow = fixture('list', 390)
export const detailNarrow = fixture('detail', 390)
