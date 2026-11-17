import { test, expect } from './helpers/orca-app'
import {
  RUNTIME_CAPABILITIES,
  RUNTIME_PROTOCOL_VERSION,
  MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
} from '../../src/shared/remote-runtime/protocol/protocol-version'

test.use({ seedTestRepo: false })
const connection = {
  id: '11111111-1111-4111-8111-111111111111',
  label: 'Boards source host',
  baseUrl: 'https://dev.azure.com/contoso',
  viewer: { id: 'viewer', displayName: 'Alex Morgan' },
  revision: '33333333-3333-4333-8333-333333333333'
}
const project = { id: '22222222-2222-4222-8222-222222222222', name: 'Customer Portal' }
const item = {
  id: 42,
  title: 'Keep customer filters',
  project,
  type: 'Story',
  state: 'Active',
  assignee: 'Alex Morgan',
  updatedAt: '2026-11-17T15:20:00Z',
  url: `https://dev.azure.com/contoso/${project.id}/_workitems/edit/42`,
  tags: '',
  area: 'Portal',
  iteration: 'Sprint 12',
  description:
    '<p>Preserve customer filters.</p><img src="https://track.example/pixel"><script>alert(1)</script>',
  acceptanceCriteria: '<p>Return to the filtered list.</p>',
  related: []
}

test('Azure Boards source, filter, detail, back and linked composer stay read-only', async ({
  electronApp,
  orcaPage: page
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await electronApp.evaluate(
    ({ ipcMain }, data) => {
      const results = {
        status: { connections: [data.connection], credentialProtection: null },
        listProjects: [data.project],
        listTeams: [],
        listQueries: [],
        metadata: { types: ['Story'], states: ['Active'] },
        queryWorkItems: { items: [data.item], capped: true, omittedIds: [] },
        getWorkItem: data.item
      }
      for (const [name, result] of Object.entries(results)) {
        ipcMain.removeHandler(`azureDevOps:${name}`)
        ipcMain.handle(`azureDevOps:${name}`, (_event, args) =>
          name === 'getWorkItem' && args.id === 43
            ? { ...data.item, id: 43, title: 'Second linked item' }
            : result
        )
      }
    },
    { connection, project, item }
  )
  await page.evaluate(() => {
    const store = window.__store!
    store.setState((state) => ({
      settings: { ...state.settings!, visibleTaskProviders: ['github', 'azure-devops'] }
    }))
    store.getState().openTaskPage({ taskSource: 'azure-devops' })
  })
  await page.getByRole('combobox', { name: 'Organization', exact: true }).click()
  await page.getByRole('option', { name: 'Boards source host' }).click()
  await page.getByRole('combobox', { name: 'Project', exact: true }).click()
  await page.getByRole('option', { name: 'Customer Portal' }).click()
  await page.getByRole('textbox', { name: 'Search ID or title' }).fill('customer')
  await expect(
    page.getByText('First 200 results; narrow the filters or open in Azure DevOps.')
  ).toBeVisible()
  await page.getByRole('button', { name: 'AB#42 Keep customer filters' }).click()
  await expect(page.getByRole('heading', { name: 'AB#42 Keep customer filters' })).toBeVisible()
  await expect(page.locator('img[src="https://track.example/pixel"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to work items' }).click()
  await expect(page.getByRole('textbox', { name: 'Search ID or title' })).toHaveValue('customer')
  await page.getByRole('button', { name: 'AB#42 Keep customer filters' }).click()
  for (const id of [43, 42]) {
    await page.evaluate(
      ({ id, connection, project }) => {
        window.__store!.getState().openTaskPage({
          taskSource: 'azure-devops',
          openAzureDevOpsWorkItem: {
            number: id,
            url: `${connection.baseUrl}/${project.id}/_workitems/edit/${id}`,
            sourceContext: {
              kind: 'task-source',
              provider: 'azure-devops',
              projectId: 'orca-project',
              hostId: 'local',
              providerIdentity: {
                provider: 'azure-devops',
                connectionId: connection.id,
                baseUrl: connection.baseUrl,
                projectId: project.id
              }
            }
          }
        })
      },
      { id, connection, project }
    )
    await expect(
      page.getByRole('heading', {
        name: id === 43 ? 'AB#43 Second linked item' : 'AB#42 Keep customer filters'
      })
    ).toBeVisible()
  }
  await page.getByRole('button', { name: 'Launch', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const draft = await page.evaluate(() => ({
    modal: window.__store!.getState().activeModal,
    data: window.__store!.getState().modalData
  }))
  expect(draft.modal).toBe('new-workspace-composer')
  expect(draft.data).toMatchObject({
    linkedWorkItem: {
      provider: 'azure-devops',
      type: 'issue',
      number: 42,
      linkedContext: { provider: 'azure-devops', renderedText: expect.anything() }
    },
    taskSourceContext: {
      hostId: 'local',
      providerIdentity: { connectionId: connection.id, projectId: project.id }
    }
  })
})

test('Azure detail reopens through its paired source host rather than desktop credentials', async ({
  electronApp,
  orcaPage: page
}) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await electronApp.evaluate(
    ({ ipcMain }, data) => {
      ipcMain.removeHandler('azureDevOps:status')
      ipcMain.handle('azureDevOps:status', () => {
        throw new Error('Desktop credentials must not be read')
      })
      const status = {
        runtimeId: 'paired-boards',
        rendererGraphEpoch: 0,
        graphStatus: 'ready',
        authoritativeWindowId: null,
        liveTabCount: 0,
        liveLeafCount: 0,
        runtimeProtocolVersion: data.protocol,
        minCompatibleRuntimeClientVersion: data.minimum,
        capabilities: data.capabilities
      }
      const success = (result: unknown) => ({
        id: 'request',
        ok: true,
        result,
        _meta: { runtimeId: 'paired-boards' }
      })
      ipcMain.removeHandler('runtimeEnvironments:call')
      ipcMain.handle('runtimeEnvironments:call', (_event, args) => {
        if (args.selector !== 'boards-source') {
          throw new Error('Wrong source host')
        }
        if (args.method === 'status.get') {
          return success(status)
        }
        if (args.method === 'azureDevOps.status') {
          return success({ connections: [data.connection], credentialProtection: null })
        }
        throw new Error(`Unexpected method ${args.method}`)
      })
      ipcMain.removeHandler('runtimeEnvironments:subscribe')
      ipcMain.handle('runtimeEnvironments:subscribe', (event, args) => {
        if (args.selector !== 'boards-source') {
          throw new Error('Wrong source host')
        }
        if (args.method === 'azureDevOps.status') {
          event.sender.send('runtimeEnvironments:subscriptionEvent', {
            subscriptionId: args.subscriptionId,
            type: 'response',
            response: success({ connections: [data.connection], credentialProtection: null })
          })
          return { subscriptionId: args.subscriptionId, requestId: 'request' }
        }
        const results: Record<string, unknown> = {
          'azureDevOps.listProjects': [data.project],
          'azureDevOps.listTeams': [],
          'azureDevOps.listQueries': [],
          'azureDevOps.metadata': { types: [], states: [] },
          'azureDevOps.queryWorkItems': { items: [], capped: false, omittedIds: [] },
          'azureDevOps.getWorkItem': { ...data.item, title: 'Paired host work item' }
        }
        if (!(args.method in results)) {
          throw new Error('Unexpected Boards stream')
        }
        for (const message of [
          { type: 'chunk', content: JSON.stringify(results[args.method]) },
          { type: 'end' }
        ]) {
          event.sender.send('runtimeEnvironments:subscriptionEvent', {
            subscriptionId: args.subscriptionId,
            type: 'response',
            response: success(message)
          })
        }
        return { subscriptionId: args.subscriptionId, requestId: 'request' }
      })
      ipcMain.removeHandler('runtimeEnvironments:unsubscribe')
      ipcMain.handle('runtimeEnvironments:unsubscribe', () => ({}))
    },
    {
      connection,
      project,
      item,
      capabilities: [...RUNTIME_CAPABILITIES],
      protocol: RUNTIME_PROTOCOL_VERSION,
      minimum: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
    }
  )
  await page.evaluate(
    ({ connection, project, item }) => {
      const store = window.__store!
      store.setState((state) => ({
        settings: { ...state.settings!, visibleTaskProviders: ['azure-devops'] }
      }))
      store.getState().openTaskPage({
        taskSource: 'azure-devops',
        openAzureDevOpsWorkItem: {
          number: item.id,
          url: item.url,
          sourceContext: {
            kind: 'task-source',
            provider: 'azure-devops',
            projectId: 'orca-project',
            hostId: 'runtime:boards-source',
            providerIdentity: {
              provider: 'azure-devops',
              connectionId: connection.id,
              baseUrl: connection.baseUrl,
              projectId: project.id
            }
          }
        }
      })
    },
    { connection, project, item }
  )
  await expect(page.getByRole('heading', { name: 'AB#42 Paired host work item' })).toBeVisible()
})
