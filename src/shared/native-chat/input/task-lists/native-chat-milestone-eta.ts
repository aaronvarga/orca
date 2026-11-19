import type { NativeChatTask } from './native-chat-task-list'

export const MILESTONE_ETA_PATTERN = /^~?\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)? (?:s|min|h)$/

export function milestoneEtaSeconds(eta: string): { min: number; max: number } | null {
  if (!MILESTONE_ETA_PATTERN.test(eta)) {
    return null
  }
  const [range, unit] = eta.replace('~', '').split(' ')
  const values = range.split(/[–-]/).map(Number)
  const multiplier = unit === 'h' ? 3600 : unit === 'min' ? 60 : 1
  const min = values[0] * multiplier
  const max = (values[1] ?? values[0]) * multiplier
  return Number.isFinite(max) && min >= 0 && max >= min ? { min, max } : null
}

export function formatMilestoneSeconds(min: number, max = min): string {
  const unit = min >= 3600 ? 'h' : min >= 60 ? 'min' : 's'
  const divisor = unit === 'h' ? 3600 : unit === 'min' ? 60 : 1
  const lower = Math.max(1, Math.floor(min / divisor))
  const upper = Math.max(lower, Math.ceil(max / divisor))
  return `${lower === upper ? lower : `${lower}–${upper}`} ${unit}`
}

export function milestoneOverallEta(tasks: readonly NativeChatTask[]) {
  const remaining = tasks.filter((task) => task.status !== 'completed')
  const groups = new Map<string, { min: number; max: number }>()
  let incomplete = false
  remaining.forEach((task, index) => {
    const duration = task.eta ? milestoneEtaSeconds(task.eta) : null
    if (!duration) {
      incomplete = true
      return
    }
    const key = task.parallelGroup ? `parallel:${task.parallelGroup}` : `serial:${index}`
    const previous = groups.get(key)
    groups.set(key, {
      min: Math.max(previous?.min ?? 0, duration.min),
      max: Math.max(previous?.max ?? 0, duration.max)
    })
  })
  const total = [...groups.values()].reduce(
    (sum, group) => ({ min: sum.min + group.min, max: sum.max + group.max }),
    { min: 0, max: 0 }
  )
  return {
    eta: groups.size ? `~${formatMilestoneSeconds(total.min, total.max)}` : undefined,
    incomplete,
    blocked: remaining.some((task) => task.blocker),
    parallel: remaining.some((task) => task.parallelGroup)
  }
}
