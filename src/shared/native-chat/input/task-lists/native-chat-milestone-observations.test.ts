import { expect, it } from 'vitest'
import { milestoneOverallEta } from './native-chat-milestone-eta'
import { nativeChatMilestoneMetadata } from './native-chat-milestone-metadata'
import {
  observeMilestoneTimeline,
  type MilestoneSnapshot
} from './native-chat-milestone-observations'

it('takes the longest parallel milestone, adds sequential work, and flags incomplete estimates and blockers', () => {
  expect(
    milestoneOverallEta([
      { content: 'API', status: 'in_progress', eta: '2–4 min', parallelGroup: 'build' },
      { content: 'UI', status: 'pending', eta: '3–5 min', parallelGroup: 'build' },
      { content: 'Verify', status: 'pending', eta: '1–2 min' },
      { content: 'Done', status: 'completed', eta: '10 h' }
    ])
  ).toEqual({ eta: '~4–7 min', incomplete: false, blocked: false, parallel: true })
  expect(
    milestoneOverallEta([
      { content: 'Review', status: 'pending', eta: '2–1 min' },
      {
        content: 'Deploy',
        status: 'pending',
        eta: '~2 min',
        blocker: { kind: 'waiting', reason: 'Which host?' }
      }
    ])
  ).toEqual({ eta: '~2 min', incomplete: true, blocked: true, parallel: false })
})

it('preserves lower ETA bounds when an estimate crosses a display unit', () => {
  expect(
    milestoneOverallEta([{ content: 'Verify', status: 'pending', eta: '~20–90 min' }]).eta
  ).toBe('~20–90 min')
  expect(
    milestoneOverallEta([{ content: 'Read', status: 'in_progress', eta: '~30–120 s' }]).eta
  ).toBe('~30–120 s')
})

it('extracts native blocker and parallel metadata without treating it as the goal title', () => {
  expect(
    nativeChatMilestoneMetadata({
      content: 'Deploy [ETA: ~2 min] [Parallel: release] [Waiting: Which host?]',
      status: 'pending'
    })
  ).toEqual({
    content: 'Deploy',
    status: 'pending',
    eta: '~2 min',
    parallelGroup: 'release',
    blocker: { kind: 'waiting', reason: 'Which host?' }
  })
  expect(
    nativeChatMilestoneMetadata({
      content: 'Deploy [Blocked: offline] [ETA: ~2 min]',
      status: 'completed'
    })
  ).toEqual({ content: 'Deploy', status: 'completed' })
})

it('measures only observed running time, excludes idle gaps and blockers, and keeps the initial estimate for calibration', () => {
  const event = (
    at: number,
    status: 'pending' | 'in_progress' | 'completed',
    blocked = false
  ): MilestoneSnapshot => ({
    at,
    sequence: at,
    index: 0,
    list: {
      tasks: [
        {
          id: '1',
          content: 'Implement',
          status,
          eta: at < 5000 ? '~2 min' : '~1 min',
          ...(blocked ? { blocker: { kind: 'blocked', reason: 'offline' } as const } : {})
        }
      ]
    }
  })
  const snapshots = [
    event(1000, 'in_progress'),
    event(3000, 'in_progress', true),
    event(5000, 'in_progress'),
    event(9000, 'completed')
  ]
  expect(
    observeMilestoneTimeline(
      snapshots,
      [
        { start: 1000, end: 2500 },
        { start: 2000, end: 6000 },
        { start: 8000, end: 10000 }
      ],
      20000
    )
  ).toEqual({
    tasks: [
      {
        id: '1',
        content: 'Implement',
        status: 'completed',
        eta: '~1 min',
        timing: { elapsedMs: 4000, estimate: '~2 min' }
      }
    ],
    updatedAt: 9000,
    completedSamples: [{ content: 'Implement', elapsedMs: 4000, estimate: '~2 min' }]
  })
  expect(
    observeMilestoneTimeline([event(1000, 'completed')], [], 20000)?.tasks[0].timing
  ).toBeUndefined()
})

it('does not refresh on a repeated native read but does refresh after an explicit background review', () => {
  const list = { tasks: [{ content: 'Check', status: 'pending' as const, eta: '~1 min' }] }
  const snapshots: MilestoneSnapshot[] = [
    { list, at: 1000, sequence: 1, index: 0 },
    { list, at: 2000, sequence: 2, index: 0 }
  ]
  expect(observeMilestoneTimeline(snapshots, [], 3000)?.updatedAt).toBe(1000)
  expect(
    observeMilestoneTimeline(
      [...snapshots, { list, at: 2500, sequence: 3, index: 0, reviewed: true }],
      [],
      3000
    )?.updatedAt
  ).toBe(2500)
})
