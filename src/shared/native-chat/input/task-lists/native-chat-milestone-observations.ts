import type { NativeChatTask } from './native-chat-task-list'
import type { NativeChatMilestones } from './native-chat-milestones'

export type MilestoneSnapshot = {
  list: NativeChatMilestones
  at: number
  sequence: number
  index: number
  reviewed?: boolean
}
export type MilestoneWorkInterval = { start: number; end: number }

/** Only time inside observed root-agent turns counts; idle gaps and declared blockers do not. */
export function observeMilestoneTimeline(
  snapshots: MilestoneSnapshot[],
  work: MilestoneWorkInterval[],
  now: number
): NativeChatMilestones | null {
  const intervals: MilestoneWorkInterval[] = []
  for (const interval of work.toSorted((a, b) => a.start - b.start)) {
    const last = intervals.at(-1)
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
    } else {
      intervals.push({ ...interval })
    }
  }
  const duration = (start: number, end: number) =>
    intervals.reduce(
      (sum, interval) =>
        sum + Math.max(0, Math.min(end, interval.end) - Math.max(start, interval.start)),
      0
    )
  type Tracked = {
    task: NativeChatTask
    elapsed: number
    estimate?: string
    activeFrom?: number
    observed: boolean
  }
  let tracked: Tracked[] = []
  let updatedAt: number | undefined
  let signature = ''
  const samples: NonNullable<NativeChatMilestones['completedSamples']> = []
  const advance = (entry: Tracked, at: number) => {
    if (entry.activeFrom !== undefined) {
      entry.elapsed += duration(entry.activeFrom, at)
    }
  }
  for (const snapshot of snapshots.toSorted(
    (a, b) => a.sequence - b.sequence || a.index - b.index
  )) {
    const nextSignature = JSON.stringify(snapshot.list.tasks)
    if (snapshot.reviewed || nextSignature !== signature) {
      updatedAt = snapshot.at
      signature = nextSignature
    }
    const used = new Set<Tracked>()
    tracked = snapshot.list.tasks.map((task) => {
      const previous = tracked.find(
        (entry) =>
          !used.has(entry) &&
          (entry.task.content === task.content ||
            (entry.task.id === task.id &&
              task.id !== undefined &&
              (entry.task.status !== 'completed' || task.status === 'completed')))
      )
      if (previous) {
        used.add(previous)
        advance(previous, snapshot.at)
      }
      const active = task.status === 'in_progress' && !task.blocker
      const entry: Tracked = {
        task,
        elapsed: previous?.elapsed ?? 0,
        estimate: previous?.estimate ?? task.eta,
        observed: previous?.observed === true || active,
        ...(active ? { activeFrom: snapshot.at } : {})
      }
      if (
        task.status === 'completed' &&
        previous?.task.status !== 'completed' &&
        entry.observed &&
        entry.elapsed > 0
      ) {
        samples.push({
          content: task.content,
          elapsedMs: entry.elapsed,
          ...(entry.estimate ? { estimate: entry.estimate } : {})
        })
      }
      return entry
    })
  }
  if (!snapshots.length) {
    return null
  }
  const tasks = tracked.map((entry) => {
    advance(entry, now)
    return {
      ...entry.task,
      ...(entry.observed && entry.elapsed > 0
        ? {
            timing: {
              elapsedMs: entry.elapsed,
              ...(entry.estimate ? { estimate: entry.estimate } : {})
            }
          }
        : {})
    }
  })
  return {
    tasks,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(samples.length ? { completedSamples: samples.slice(-24) } : {})
  }
}
