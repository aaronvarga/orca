import { afterEach, expect, it, vi } from 'vitest'
import type {
  RemoteRuntimeMultiplexedTerminal,
  RemoteRuntimeMultiplexedTerminalCallbacks
} from '@/runtime/hosted-terminals/streams/remote-terminal-stream-contracts'
import { toRemoteRuntimePtyId } from '../../../../../../shared/remote-runtime/remote-runtime-pty-id'

const { subscribeTerminal } = vi.hoisted(() => ({ subscribeTerminal: vi.fn() }))
vi.mock(
  '@/runtime/hosted-terminals/streams/registry/remote-runtime-terminal-multiplexer-registry',
  () => ({
    getRemoteRuntimeTerminalMultiplexer: () => ({ subscribeTerminal })
  })
)
vi.mock('@/lib/pane-manager/terminal-output/terminal-delivery-credit', () => ({
  takeCurrentTerminalDeliveryCredit: () => null
}))

import {
  remoteRuntimeTerminalPreviewApi as api,
  resetRemoteRuntimeTerminalPreviewSessionsForTests
} from './remote-runtime-terminal-preview-api'

function streamFixture() {
  let closed = false
  const input: string[] = []
  const stream: RemoteRuntimeMultiplexedTerminal = {
    sendInput: (text: string) => {
      if (closed) {
        return false
      }
      input.push(text)
      return true
    },
    close: () => {
      closed = true
    },
    resize: () => !closed,
    claimViewport: () => !closed,
    streamId: 1,
    acknowledgesInput: () => false,
    inputLedgerId: () => null,
    setOutputPaused: () => false,
    setOutputCadence: () => {},
    serializeBuffer: async () => null,
    serializeBufferOutcome: async () => ({
      snapshot: null,
      availability: { kind: 'unknown-legacy-host' }
    })
  }
  return { stream, input, isClosed: () => closed }
}

afterEach(() => {
  resetRemoteRuntimeTerminalPreviewSessionsForTests()
  subscribeTerminal.mockReset()
})

it('releases late connections and ignores retired callbacks, input, and cleanup', async () => {
  const first = streamFixture()
  const second = streamFixture()
  let firstCallbacks: RemoteRuntimeMultiplexedTerminalCallbacks
  let secondCallbacks: RemoteRuntimeMultiplexedTerminalCallbacks
  let finishFirst: (stream: RemoteRuntimeMultiplexedTerminal) => void
  subscribeTerminal
    .mockImplementationOnce(({ callbacks }) => {
      firstCallbacks = callbacks
      return new Promise((resolve) => {
        finishFirst = resolve
      })
    })
    .mockImplementationOnce(({ callbacks }) => {
      secondCallbacks = callbacks
      return Promise.resolve(second.stream)
    })
  const ptyId = toRemoteRuntimePtyId('terminal', 'host')
  const old = { viewerId: 'tile', connectionToken: 'old' }
  const current = { viewerId: 'tile', connectionToken: 'current' }
  const events: string[] = []
  api.onData((payload) => {
    if (payload.type === 'data') {
      events.push(payload.data)
    }
  })
  const oldConnection = api.connect(ptyId, { connection: old })
  await api.unsubscribe(ptyId, old)
  const currentConnection = api.connect(ptyId, { connection: current })
  secondCallbacks!.onSnapshot('new frame', { cols: 90, rows: 30 })
  expect(await currentConnection).toEqual({
    snapshot: { data: 'new frame', cols: 90, rows: 30 },
    replay: []
  })
  finishFirst!(first.stream)
  firstCallbacks!.onSnapshot('old frame', { cols: 40, rows: 20 })
  firstCallbacks!.onData('old output')
  secondCallbacks!.onData('new output')
  await oldConnection
  await api.unsubscribe(ptyId, old)
  expect(await api.input(ptyId, 'stale', old)).toBe(false)
  expect(await api.input(ptyId, 'typed', current)).toBe(true)
  expect(first.isClosed()).toBe(true)
  expect(second.isClosed()).toBe(false)
  expect(events).toEqual(['new output'])
  expect(second.input).toEqual(['typed'])
})

it('keeps a legacy stream read-only when the host cannot confirm its process identity', async () => {
  const fixture = streamFixture()
  let callbacks: RemoteRuntimeMultiplexedTerminalCallbacks
  subscribeTerminal.mockImplementationOnce((args) => {
    callbacks = args.callbacks
    return Promise.resolve(fixture.stream)
  })
  const ptyId = toRemoteRuntimePtyId('terminal', 'host')
  const connection = {
    viewerId: 'tile',
    connectionToken: 'connection',
    incarnationId: 'expected-process'
  }
  const connected = api.connect(ptyId, { connection })
  callbacks!.onSnapshot('legacy snapshot', { cols: 80, rows: 24 })
  await connected
  expect(await api.input(ptyId, 'unsafe', connection)).toBe(false)
  expect(await api.fit(ptyId, 100, 40, connection, 'claim')).toBeNull()
  expect(fixture.input).toEqual([])
})
