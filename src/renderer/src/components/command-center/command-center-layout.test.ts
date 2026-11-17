import { expect, test } from 'vitest'
import {
  moveCommandCenterSession,
  orderCommandCenterSessions,
  commandCenterColumns
} from './command-center-layout'
import { commandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'

test('reordering keeps every session and does not apply a retired incarnation order to its replacement', () => {
  const order = moveCommandCenterSession(
    ['host/a/1', 'host/b/1', 'host/c/1'],
    'host/c/1',
    'host/a/1'
  )
  expect(order).toEqual(['host/c/1', 'host/a/1', 'host/b/1'])
  expect(
    orderCommandCenterSessions(
      [{ id: 'host/a/2' }, { id: 'host/b/1' }, { id: 'host/c/1' }],
      order
    ).map((s) => s.id)
  ).toEqual(['host/c/1', 'host/b/1', 'host/a/2'])
})

test('automatic grids use one column on narrow screens and manual layouts keep requested columns', () => {
  expect(commandCenterColumns(commandCenterPresentation({}), 6, 300)).toBe(1)
  expect(
    commandCenterColumns(commandCenterPresentation({ layout: 'manual', columns: 4 }), 6, 300)
  ).toBe(4)
})
