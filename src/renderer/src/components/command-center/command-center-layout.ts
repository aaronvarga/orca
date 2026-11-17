import type { CommandCenterPresentation } from '../../../../shared/ui-chrome/command-center-presentation'

export const COMMAND_CENTER_PRESETS = [
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [1, 2],
  [1, 3],
  [2, 2],
  [3, 2],
  [2, 3],
  [4, 2],
  [5, 2],
  [3, 3],
  [4, 3],
  [4, 4]
] as const

export function commandCenterColumns(
  layout: CommandCenterPresentation,
  count: number,
  width: number
): number {
  if (layout.layout === 'manual') {
    return layout.columns
  }
  if (layout.layout === 'auto-columns') {
    return Math.max(1, count)
  }
  return Math.max(1, Math.min(count, Math.floor((width + 12) / 332)))
}

export function orderCommandCenterSessions<T extends { id: string }>(
  sessions: readonly T[],
  order: readonly string[]
): T[] {
  const ranks = new Map(order.map((id, index) => [id, index]))
  return [...sessions].sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity))
}

export function moveCommandCenterSession(
  ids: readonly string[],
  source: string,
  target: string
): string[] {
  if (source === target || !ids.includes(source) || !ids.includes(target)) {
    return [...ids]
  }
  const next = ids.filter((id) => id !== source)
  next.splice(ids.indexOf(target), 0, source)
  return next
}
