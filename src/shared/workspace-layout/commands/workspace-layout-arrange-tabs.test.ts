import { describe, expect, it } from 'vitest'
import { build, testContext, WS } from './workspace-layout-command.test-fixture'

describe('arrangeTabs', () => {
  it('tiles open tabs without replacing their sessions, and keeps overflow tabs', () => {
    const context = testContext()
    const { model } = build(
      context,
      ['a', 'b', 'c', 'd', 'e'].map((tabId) => ({
        type: 'createTerminalTab',
        workspace: WS,
        tabId
      }))
    )
    const { model: arranged } = build(
      context,
      [{ type: 'arrangeTabs', workspace: WS, columns: 2, rows: 2 }],
      model
    )
    const workspace = arranged.workspaces[WS]!
    expect(workspace.tabs).toEqual(model.workspaces[WS]!.tabs)
    expect(workspace.leaves).toEqual(model.workspaces[WS]!.leaves)
    expect(workspace.groups.map((group) => group.tabOrder)).toEqual([
      ['a', 'e'],
      ['b'],
      ['c'],
      ['d']
    ])
    expect(workspace.groupLayout).toMatchObject({
      type: 'split',
      direction: 'vertical',
      ratio: 0.5,
      first: { type: 'split', direction: 'horizontal', ratio: 0.5 },
      second: { type: 'split', direction: 'horizontal', ratio: 0.5 }
    })
    const { model: stacked } = build(
      context,
      [{ type: 'arrangeTabs', workspace: WS, columns: 1, rows: 1 }],
      arranged
    )
    expect(stacked.workspaces[WS]!.groups.map((group) => group.tabOrder)).toEqual([
      ['a', 'e', 'b', 'c', 'd']
    ])
  })

  it('keeps tabs excluded by the client visibility projection', () => {
    const context = testContext()
    const { model } = build(context, [
      { type: 'createTerminalTab', workspace: WS, tabId: 'terminal' },
      {
        type: 'openEditorTab',
        workspace: WS,
        tabId: 'editor',
        fileId: '/w/a.ts',
        contentType: 'editor'
      }
    ])
    const { model: arranged } = build(
      { ...context, visibility: (tab) => tab.kind === 'terminal' },
      [{ type: 'arrangeTabs', workspace: WS, columns: 2, rows: 1 }],
      model
    )
    expect(arranged.workspaces[WS]!.groups.map((group) => group.tabOrder)).toEqual([
      ['terminal'],
      ['editor']
    ])
    expect(arranged.workspaces[WS]!.tabs).toEqual(model.workspaces[WS]!.tabs)
  })
})
