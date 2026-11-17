import { expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../../dispatcher'
import type { OrcaRuntimeService } from '../../../orca-runtime'
import { AZURE_DEVOPS_METHODS } from './azure-devops'

const selection = {
  connectionId: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  revision: '33333333-3333-4333-8333-333333333333'
}
it('streams work-item details within frame limits and rejects malformed source selections before invoking the host', async () => {
  const description = 'source prose '.repeat(30000)
  const get = vi.fn(async () => ({ id: 42, description }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this dispatcher only invokes the supplied detail method.
  const runtime = {
    getRuntimeId: () => 'source-host',
    azureDevOpsGetWorkItem: get
  } as unknown as OrcaRuntimeService
  const dispatcher = new RpcDispatcher({ runtime, methods: AZURE_DEVOPS_METHODS })
  const replies: string[] = []
  await dispatcher.dispatchStreaming(
    {
      id: 'read',
      authToken: 'owner',
      method: 'azureDevOps.getWorkItem',
      params: { ...selection, id: 42 }
    },
    (reply) => replies.push(reply)
  )
  const messages: { type: string; content?: string }[] = replies.map(
    (reply) => JSON.parse(reply).result
  )
  expect(messages.at(-1)).toEqual({ type: 'end' })
  expect(messages.every((message) => (message.content?.length ?? 0) <= 262144)).toBe(true)
  expect(JSON.parse(messages.map((message) => message.content ?? '').join(''))).toEqual({
    id: 42,
    description
  })
  get.mockClear()
  replies.length = 0
  await dispatcher.dispatchStreaming(
    {
      id: 'bad',
      authToken: 'owner',
      method: 'azureDevOps.getWorkItem',
      params: { ...selection, projectId: 'https://other.example/token', id: -1 }
    },
    (reply) => replies.push(reply)
  )
  expect(replies.some((reply) => JSON.parse(reply).error?.code === 'invalid_argument')).toBe(true)
  expect(get).not.toHaveBeenCalled()
})
it('denies credential administration to mobile callers', async () => {
  const connect = vi.fn()
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the denied call must never invoke the supplied connect method.
  const runtime = {
    getRuntimeId: () => 'source-host',
    azureDevOpsConnect: connect
  } as unknown as OrcaRuntimeService
  const dispatcher = new RpcDispatcher({
    runtime,
    methods: AZURE_DEVOPS_METHODS,
    callerScope: { kind: 'mobile' }
  })
  const result = await dispatcher.dispatch({
    id: 'connect',
    authToken: 'phone',
    method: 'azureDevOps.connect',
    params: { baseUrl: 'https://dev.azure.com/alpha', label: 'Alpha', token: 'secret' }
  })
  expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } })
  expect(connect).not.toHaveBeenCalled()
})
