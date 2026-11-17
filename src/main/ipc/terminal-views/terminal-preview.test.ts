import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrcaRuntimeService } from '../../runtime/orca-runtime'
import type { TerminalPreviewConnection } from '../../../shared/terminal/replay/terminal-preview'

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args: unknown) => unknown>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (name: string) => handlers.delete(name),
    handle: (name: string, handler: (event: unknown, args: unknown) => unknown) =>
      handlers.set(name, handler)
  }
}))
vi.mock('../ui', () => ({ isTrustedUIRenderer: () => true }))
vi.mock('../../window/dashboard-popout-window', () => ({ isDashboardPopoutRenderer: () => false }))
vi.mock('../renderer-requests/renderer-lifetime-abort', () => ({
  abortWhenRendererGone: () => ({ signal: new AbortController().signal, dispose: () => {} })
}))

import { registerTerminalPreviewHandlers } from './terminal-preview'

function previewHost() {
  let incarnation = 'process-original'
  let size = { cols: 120, rows: 40 }
  let owner: string | null = null
  const input: string[] = []
  const runtime = {
    getTerminalPreviewIncarnation: () => incarnation,
    registerRawTerminalViewSubscriber: () => () => {},
    subscribeToTerminalData: () => () => {},
    subscribeToTerminalResize: () => () => {},
    getTerminalSize: () => size,
    serializeTerminalBuffer: async () => ({ data: 'shell', ...size }),
    writeTerminalPreviewInput: async (_ptyId: string, data: string) => {
      input.push(data)
      return true
    },
    updateRemoteDesktopViewer: async (
      _ptyId: string,
      viewer: string,
      _client: string,
      cols: number,
      rows: number,
      claim: boolean
    ) => {
      if (claim) {
        owner = viewer
      }
      if (owner === viewer) {
        size = { cols, rows }
      }
      return true
    },
    unregisterRemoteDesktopViewer: async (_ptyId: string, viewer: string) => {
      if (owner === viewer) {
        owner = null
      }
      return true
    }
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The fixture implements every runtime method invoked by the preview IPC handler.
  registerTerminalPreviewHandlers(runtime as unknown as OrcaRuntimeService)
  const sender = { id: 1, isDestroyed: () => false, send: () => {} }
  const invoke = (method: string, connection: TerminalPreviewConnection, args = {}) =>
    handlers.get(`terminalPreview:${method}`)!(
      { sender },
      { ptyId: 'pty-shell', connection, ...args }
    )
  const connect = (connection: TerminalPreviewConnection) =>
    invoke('connect', connection, { opts: { connection } })
  return {
    input,
    invoke,
    connect,
    hostResize: (cols: number, rows: number) => {
      if (!owner) {
        size = { cols, rows }
      }
      return size
    },
    replaceProcess: () => {
      incarnation = 'process-replacement'
    }
  }
}

const original = {
  viewerId: 'tile-shell',
  connectionToken: 'stream-original',
  incarnationId: 'process-original'
}
const replacement = { ...original, connectionToken: 'stream-replacement' }

beforeEach(() => handlers.clear())

describe('terminal preview connection ownership', () => {
  it('ignores retired input, fitting, and unsubscribe without retiring the replacement', async () => {
    const host = previewHost()
    await host.connect(original)
    await host.connect(replacement)

    expect(await host.invoke('input', original, { data: 'retired' })).toBe(false)
    expect(await host.invoke('fit', original, { cols: 10, rows: 10, intent: 'claim' })).toBeNull()
    await host.invoke('unsubscribe', original)
    expect(await host.invoke('input', replacement, { data: 'current' })).toBe(true)
    expect(host.input).toEqual(['current'])

    host.replaceProcess()
    expect(await host.invoke('input', replacement, { data: 'wrong-process' })).toBe(false)
    expect(
      await host.invoke('fit', replacement, { cols: 30, rows: 20, intent: 'claim' })
    ).toBeNull()
    expect(await host.connect(replacement)).toEqual({ snapshot: null, replay: [] })
    expect(host.input).toEqual(['current'])
  })

  it('releases a retained viewport claim when a reconnected consumer leaves without fitting again', async () => {
    const host = previewHost()
    await host.connect(original)
    await host.invoke('fit', original, { cols: 90, rows: 30, intent: 'claim' })
    await host.connect(replacement)
    await host.invoke('unsubscribe', original)
    expect(host.hostResize(120, 40)).toEqual({ cols: 90, rows: 30 })
    await host.invoke('unsubscribe', replacement)
    expect(host.hostResize(120, 40)).toEqual({ cols: 120, rows: 40 })
  })

  it('keeps two consumers separate and passive fitting cannot take the other consumer grid', async () => {
    const host = previewHost()
    const second = { ...original, viewerId: 'dialog-shell', connectionToken: 'stream-dialog' }
    await host.connect(original)
    await host.connect(second)
    expect(await host.invoke('fit', original, { cols: 90, rows: 30, intent: 'claim' })).toEqual({
      cols: 90,
      rows: 30
    })
    expect(await host.invoke('fit', second, { cols: 60, rows: 20, intent: 'passive' })).toEqual({
      cols: 90,
      rows: 30
    })
    await host.invoke('unsubscribe', second)
    expect(await host.invoke('input', original, { data: 'still attached' })).toBe(true)
    expect(await host.invoke('fit', original, { cols: 100, rows: 35, intent: 'passive' })).toEqual({
      cols: 100,
      rows: 35
    })
    expect(host.input).toEqual(['still attached'])
  })
})
