import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type * as Os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setSecretStore } from '../../shared/secure-storage/secret-store'
import { publishAzureDevOpsConnection } from './connection-store'
import { createAzureDevOpsPullRequest } from './pull-request-creation'
import { isProviderAuthenticated } from '../source-control/hosted-review-creation-provider'

const home = vi.hoisted(() => ({ path: '' }))
vi.mock('node:os', async (original) => ({
  ...(await original<typeof Os>()),
  homedir: () => home.path
}))
vi.mock('./repository-ref', () => ({
  getAzureDevOpsRepoRef: vi.fn(async () => ({
    host: 'dev.azure.com',
    project: 'Project',
    repository: 'repo',
    apiBaseUrl: 'https://dev.azure.com/alpha/Project',
    webBaseUrl: 'https://dev.azure.com/alpha/Project/_git/repo'
  }))
}))
const fetchMock = vi.fn<typeof fetch>()
beforeEach(async () => {
  home.path = mkdtempSync(join(tmpdir(), 'orca-azure-pr-auth-'))
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
  await publishAzureDevOpsConnection(
    {
      baseUrl: 'https://dev.azure.com/alpha',
      label: 'Alpha',
      viewer: { id: 'owner', displayName: 'Owner' }
    },
    'saved-pat'
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  rmSync(home.path, { recursive: true, force: true })
})
const input = { provider: 'azure-devops' as const, base: 'main', head: 'feature', title: 'PR' }
it('uses a saved-only credential for hosted-review preflight and PR creation ahead of an environment account', async () => {
  vi.stubEnv('ORCA_AZURE_DEVOPS_TOKEN', '')
  vi.stubEnv('ORCA_AZURE_DEVOPS_PAT', '')
  vi.stubEnv('ORCA_AZURE_DEVOPS_ACCESS_TOKEN', '')
  await expect(isProviderAuthenticated('azure-devops', '/repo', 'local')).resolves.toBe(true)
  vi.stubEnv('ORCA_AZURE_DEVOPS_TOKEN', 'other-account')
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        pullRequestId: 7,
        title: 'PR',
        status: 'active',
        url: 'https://dev.azure.com/alpha/Project/_git/repo/pullrequest/7'
      })
    )
  )
  const created = await createAzureDevOpsPullRequest('/repo', input, 'local')
  expect(created).toMatchObject({ ok: true, number: 7 })
  expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
    Authorization: 'Basic OnNhdmVkLXBhdA=='
  })
  expect(fetchMock.mock.calls[0][1]?.redirect).toBe('error')
})
it('does not replay a PR mutation with unknown completion', async () => {
  const requests: string[] = []
  fetchMock.mockImplementation(async (_url, init) => {
    requests.push(init?.method ?? 'GET')
    if (init?.method === 'POST') {
      throw new DOMException('timed out', 'TimeoutError')
    }
    return new Response('{}', { status: 404 })
  })
  await expect(createAzureDevOpsPullRequest('/repo', input, 'local')).resolves.toMatchObject({
    ok: false,
    code: 'unknown_completion'
  })
  expect(requests.filter((method) => method === 'POST')).toEqual(['POST'])
})
