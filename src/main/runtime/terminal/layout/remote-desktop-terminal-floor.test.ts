import { expect, it } from 'vitest'
import { RemoteDesktopTerminalFloor } from './remote-desktop-terminal-floor'

it('applies passive geometry only for its current desktop owner and retains phone priority', async () => {
  let size = { cols: 120, rows: 40 }
  let mobile = false
  const floor = new RemoteDesktopTerminalFloor({
    isMobileDriven: () => mobile,
    getTerminalSize: () => size,
    resolveHostTarget: () => ({ cols: 120, rows: 40 }),
    hostShowsTerminals: () => true,
    applyLayout: async (_ptyId, target) => {
      size = { cols: target.cols, rows: target.rows }
      return { ok: true }
    }
  })
  await floor.updateViewer('shell', 'desktop', 'laptop', 90, 30, true)
  await floor.updateViewer('shell', 'tile', 'grid', 60, 20, false)
  expect(size).toEqual({ cols: 90, rows: 30 })
  await floor.updateViewer('shell', 'desktop', 'laptop', 100, 35, false)
  expect(size).toEqual({ cols: 100, rows: 35 })
  mobile = true
  size = { cols: 40, rows: 20 }
  await floor.updateViewer('shell', 'desktop', 'laptop', 110, 45, false)
  expect(size).toEqual({ cols: 40, rows: 20 })
  await floor.updateViewer('shell', 'tile', 'grid', 70, 25, true)
  expect(size).toEqual({ cols: 40, rows: 20 })
  mobile = false
  await floor.applyLayout('shell')
  expect(size).toEqual({ cols: 70, rows: 25 })
  await floor.updateViewer('shell', 'desktop', 'laptop', 100, 35, false)
  expect(size).toEqual({ cols: 70, rows: 25 })
})
