import { afterEach, expect, it, vi } from 'vitest'
import { readRuntimeIntegrationPayload } from '../jira/runtime-jira-payload-stream'

afterEach(() => vi.unstubAllGlobals())
it.each(['incomplete', 'oversized'])(
  'rejects %s integration transfers instead of returning partial details',
  async (failure) => {
    const unsubscribe = vi.fn()
    const subscribe = vi.fn(async (_args, callbacks) => {
      if (failure === 'incomplete') {
        callbacks.onResponse({
          ok: true,
          result: { type: 'chunk', content: '{"description":"partial' }
        })
        callbacks.onClose()
      } else {
        callbacks.onResponse({ ok: true, result: { type: 'chunk', content: 'x'.repeat(33554433) } })
      }
      return { unsubscribe }
    })
    vi.stubGlobal('window', { api: { runtimeEnvironments: { subscribe } } })
    await expect(
      readRuntimeIntegrationPayload(
        { kind: 'environment', environmentId: 'source' },
        'azureDevOps.getWorkItem',
        {}
      )
    ).rejects.toThrow(failure === 'incomplete' ? 'closed before completion' : 'transfer limit')
    expect(unsubscribe).toHaveBeenCalled()
  }
)
it('cancels a pending source read without accepting a later result', async () => {
  const unsubscribe = vi.fn()
  vi.stubGlobal('window', {
    api: { runtimeEnvironments: { subscribe: vi.fn(async () => ({ unsubscribe })) } }
  })
  const controller = new AbortController()
  const pending = readRuntimeIntegrationPayload(
    { kind: 'environment', environmentId: 'source' },
    'azureDevOps.queryWorkItems',
    {},
    controller.signal
  )
  controller.abort(new Error('source changed'))
  await expect(pending).rejects.toThrow('source changed')
  expect(unsubscribe).toHaveBeenCalled()
})
