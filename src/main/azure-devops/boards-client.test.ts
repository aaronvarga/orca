import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setSecretStore } from '../../shared/secure-storage/secret-store'
import {
  azureDevOpsConnect,
  azureDevOpsListTeams,
  azureDevOpsQueryWorkItems,
  azureDevOpsStatus,
  azureDevOpsWiql
} from './boards-client'
import { publishAzureDevOpsConnection, withAzureDevOpsRead } from './connection-store'
import {
  AzureDevOpsCredentialAccessError,
  requestAzureDevOpsJsonAtBase,
  resolveAzureDevOpsAuthConfig
} from './azure-devops-api-request'

const home = vi.hoisted(() => ({ path: '' }))
vi.mock('node:os', async (original) => ({
  ...(await original<typeof Os>()),
  homedir: () => home.path
}))
const projectId = '22222222-2222-4222-8222-222222222222'
const viewer = { id: '33333333-3333-4333-8333-333333333333', displayName: 'Owner' }
function connection(baseUrl = 'https://dev.azure.com/alpha', token = 'saved-pat') {
  return publishAzureDevOpsConnection({ baseUrl, label: 'Alpha', viewer }, token)
}
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status })
}
const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  home.path = mkdtempSync(join(tmpdir(), 'orca-boards-'))
  setSecretStore({
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('unavailable')
    },
    decryptString: () => {
      throw new Error('unavailable')
    },
    describeProtectionGap: () => null
  })
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  rmSync(home.path, { recursive: true, force: true })
})

describe('Azure Boards owning read boundary', () => {
  it('escapes search and project literals and leaves custom state/type filters intact', () => {
    expect(
      azureDevOpsWiql(
        {
          connectionId: 'c',
          projectId,
          revision: 'r',
          search: "Sam's",
          state: 'Custom',
          type: "Team's Type"
        },
        "Owner's Project"
      )
    ).toBe(
      "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = 'Owner''s Project' AND [System.AssignedTo] = @Me AND [System.Title] CONTAINS 'Sam''s' AND [System.State] = 'Custom' AND [System.WorkItemType] = 'Team''s Type' ORDER BY [System.ChangedDate] DESC, [System.Id] DESC"
    )
  })
  it('enumerates every team using offset pages without a continuation header', async () => {
    const saved = connection()
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input))
      expect(url.searchParams.get('$top')).toBe('100')
      return json({
        value:
          url.searchParams.get('$skip') === '0'
            ? Array.from({ length: 100 }, (_, i) => ({ id: `team-${i}`, name: `Team ${i}` }))
            : [{ id: 'team-last', name: 'Last Team' }]
      })
    })
    const teams = await azureDevOpsListTeams({
      connectionId: saved.id,
      revision: saved.revision,
      projectId
    })
    expect(teams).toHaveLength(101)
    expect(teams.at(-1)).toEqual({ id: 'team-last', name: 'Last Team' })
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('$skip')).toBe('100')
  })
  it('preserves query order and identifies capped and omitted results while hydrating at most 200 IDs', async () => {
    const saved = connection()
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input))
      if (url.pathname.includes('/_apis/projects/')) {
        return json({ id: projectId, name: 'Project' })
      }
      if (url.pathname.endsWith('/wiql')) {
        return json({
          queryType: 'flat',
          workItems: Array.from({ length: 201 }, (_, i) => ({ id: i + 1 }))
        })
      }
      const body = JSON.parse(String(init?.body))
      expect(body.ids).toHaveLength(200)
      expect(body.ids.at(-1)).toBe(200)
      return json({
        value: [
          { id: 2, fields: { 'System.Title': 'Second', 'System.TeamProject': 'Project' } },
          { id: 1, fields: { 'System.Title': 'First', 'System.TeamProject': 'Project' } }
        ]
      })
    })
    const result = await azureDevOpsQueryWorkItems({
      connectionId: saved.id,
      revision: saved.revision,
      projectId
    })
    expect(result.items.map((item) => item.id)).toEqual([1, 2])
    expect(result.capped).toBe(true)
    expect(result.omittedIds).toHaveLength(198)
    expect(result.omittedIds[0]).toBe(3)
    expect(result.omittedIds.at(-1)).toBe(200)
  })
  it('rejects cross-project flat results instead of assigning the query project to them', async () => {
    const saved = connection()
    fetchMock
      .mockResolvedValueOnce(json({ id: projectId, name: 'Selected' }))
      .mockResolvedValueOnce(json({ queryType: 'flat', workItems: [{ id: 5 }] }))
      .mockResolvedValueOnce(
        json({
          value: [{ id: 5, fields: { 'System.Title': 'Foreign', 'System.TeamProject': 'Other' } }]
        })
      )
    await expect(
      azureDevOpsQueryWorkItems({
        connectionId: saved.id,
        revision: saved.revision,
        projectId,
        queryId: 'query'
      })
    ).rejects.toThrow('Cross-project queries are unsupported')
  })
  it.each(['tree', 'oneHop'])('rejects %s queries before hydration', async (queryType) => {
    const saved = connection()
    fetchMock
      .mockResolvedValueOnce(json({ id: projectId, name: 'Selected' }))
      .mockResolvedValueOnce(json({ queryType, workItemRelations: [] }))
    await expect(
      azureDevOpsQueryWorkItems({
        connectionId: saved.id,
        revision: saved.revision,
        projectId,
        queryId: 'query',
        teamId: 'team'
      })
    ).rejects.toThrow('Hierarchical and linked queries are unsupported')
  })
  it('does not publish invalid replacement credentials or treat an anonymous viewer as verified', async () => {
    const saved = connection()
    fetchMock.mockResolvedValueOnce(json({}, 401))
    await expect(
      azureDevOpsConnect({ baseUrl: saved.baseUrl, label: 'Replacement', token: 'bad' })
    ).rejects.toThrow(AzureDevOpsCredentialAccessError)
    expect(resolveAzureDevOpsAuthConfig(saved.baseUrl).pat).toBe('saved-pat')
    fetchMock.mockResolvedValueOnce(
      json({
        authenticatedUser: {
          id: '00000000-0000-0000-0000-000000000000',
          providerDisplayName: 'Anonymous'
        }
      })
    )
    await expect(
      azureDevOpsConnect({ baseUrl: saved.baseUrl, label: 'Replacement', token: 'anonymous' })
    ).rejects.toThrow('authenticated viewer')
    expect(azureDevOpsStatus().connections[0].revision).toBe(saved.revision)
  })
  it('prevents a pending old revision from returning after successful replacement', async () => {
    const saved = connection()
    let finish!: (value: string) => void
    const pending = withAzureDevOpsRead(
      saved.id,
      saved.revision,
      undefined,
      async () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    )
    const next = connection('https://dev.azure.com/alpha', 'replacement')
    finish('old account data')
    await expect(pending).rejects.toThrow()
    expect(next.id).toBe(saved.id)
    expect(next.revision).not.toBe(saved.revision)
    expect(resolveAzureDevOpsAuthConfig(saved.baseUrl).pat).toBe('replacement')
  })
  it('isolates saved credentials, prefers them to environment auth, and refuses redirects', async () => {
    connection()
    connection('https://dev.azure.com/beta', 'beta-pat')
    vi.stubEnv('ORCA_AZURE_DEVOPS_TOKEN', 'environment-pat')
    expect(resolveAzureDevOpsAuthConfig('https://alpha.visualstudio.com/Project').pat).toBe(
      'saved-pat'
    )
    expect(resolveAzureDevOpsAuthConfig('https://dev.azure.com/beta/Project').pat).toBe('beta-pat')
    expect(resolveAzureDevOpsAuthConfig('https://dev.azure.com/unknown/Project').pat).toBe(
      'environment-pat'
    )
    fetchMock.mockResolvedValue(json({ ok: true }))
    await requestAzureDevOpsJsonAtBase(
      'https://dev.azure.com/alpha/Project',
      '/_apis/git/repositories',
      {},
      true
    )
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('error')
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Basic OnNhdmVkLXBhdA=='
    })
  })
})

it('reports saved-account Code permission failures instead of returning an absent PR', async () => {
  connection()
  vi.stubEnv('ORCA_AZURE_DEVOPS_TOKEN', 'other-working-account')
  fetchMock.mockResolvedValue(json({}, 403))
  await expect(
    requestAzureDevOpsJsonAtBase(
      'https://dev.azure.com/alpha/Project',
      '/_apis/git/repositories/repo'
    )
  ).rejects.toMatchObject({ status: 403, name: 'AzureDevOpsCredentialAccessError' })
  expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
    Authorization: 'Basic OnNhdmVkLXBhdA=='
  })
})
it('advances an environment read generation when its effective bearer token changes alongside a stable PAT', () => {
  vi.stubEnv('ORCA_AZURE_DEVOPS_API_BASE_URL', 'https://dev.azure.com/environment-org')
  vi.stubEnv('ORCA_AZURE_DEVOPS_TOKEN', 'stable-pat')
  vi.stubEnv('ORCA_AZURE_DEVOPS_ACCESS_TOKEN', 'first-bearer')
  const before = azureDevOpsStatus().connections.find((entry) => entry.externallyManaged)!
  vi.stubEnv('ORCA_AZURE_DEVOPS_ACCESS_TOKEN', 'second-bearer')
  const after = azureDevOpsStatus().connections.find((entry) => entry.externallyManaged)!
  expect(after.id).toBe(before.id)
  expect(after.revision).not.toBe(before.revision)
})

it('verifies and connects two independent organizations without exposing tokens in public metadata', async () => {
  fetchMock.mockImplementation(async (input) =>
    new URL(String(input)).pathname.endsWith('/connectionData')
      ? json({
          authenticatedUser: {
            id: '33333333-3333-4333-8333-333333333333',
            providerDisplayName: 'Verified owner'
          }
        })
      : json({ value: [] })
  )
  const alpha = await azureDevOpsConnect({
    baseUrl: 'https://alpha.visualstudio.com',
    label: 'Alpha',
    token: 'first-secret'
  })
  const beta = await azureDevOpsConnect({
    baseUrl: 'https://dev.azure.com/beta',
    label: 'Beta',
    token: 'second-secret'
  })
  expect(alpha.baseUrl).toBe('https://dev.azure.com/alpha')
  expect(beta.id).not.toBe(alpha.id)
  expect(azureDevOpsStatus().connections.map((entry) => entry.label)).toEqual(['Alpha', 'Beta'])
  expect(JSON.stringify(azureDevOpsStatus())).not.toContain('first-secret')
  expect(JSON.stringify(beta)).not.toContain('second-secret')
})
