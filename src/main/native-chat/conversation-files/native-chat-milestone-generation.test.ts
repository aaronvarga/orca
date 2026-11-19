import { createHash } from 'node:crypto'
import { readAgentSessionHistory } from '../agent-session-wire/publication/history/agent-session-history-page'
import { createMilestoneReview } from './native-chat-milestone-review'
import { generateSessionMilestones } from './native-chat-milestone-generation'
import { agentSessionRecordFixture } from '../testing/agent-session-record-test-fixture'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createTrackedJournalOpener } from '../agent-session-journal/store-lifecycle/journal-host-database-test-support'
import { claudeProviderHandle } from '../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'

const journals = createTrackedJournalOpener()
let root: string

afterEach(async () => {
  await journals.closeAll()
  if (root) {
    await rm(root, { recursive: true, force: true })
  }
})

async function open(sessionId: string) {
  return journals.open({
    identity: {
      sessionId,
      workspaceId: 'folder',
      hostId: 'local',
      agent: 'claude',
      providerHandle: claudeProviderHandle(sessionId, null)
    },
    stateDirectory: root
  })
}
async function task(
  journal: AgentSessionJournal,
  id: string,
  input: unknown,
  output: string,
  name = 'TaskCreate'
) {
  await journal.appendItem(
    { provider: 'orca', clientMessageId: id },
    {
      kind: 'tool-call',
      name,
      input,
      state: 'completed',
      callId: id,
      output: { head: output, truncated: false, byteLength: output.length, digest: 'test' }
    },
    { fence: 0, turnScope: { kind: 'thread' } }
  )
}

it('persists isolated generation without a main-agent message, rejects invalid output, and keeps a newer native plan', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-isolated-milestones-'))
  const journal = await open('background')
  const record = agentSessionRecordFixture({ sessionId: 'background' })
  const generate = (worker: () => Promise<string>) =>
    generateSessionMilestones({
      record,
      journal,
      generate: worker,
      current: () => true,
      fence: () => 0
    })
  expect(
    await generate(
      async () =>
        '{"tasks":[{"content":"Finish remaining work","details":"Check delivery retries for issue #42.","status":"in_progress","eta":"~2–4 min"}]}'
    )
  ).toEqual({ applied: true })
  expect((await journal.reads.milestones())?.tasks).toEqual([
    {
      id: expect.any(String),
      content: 'Finish remaining work',
      details: 'Check delivery retries for issue #42.',
      status: 'in_progress',
      eta: '~2–4 min'
    }
  ])
  expect(await journal.reads.namingPrompt()).toBe('')
  await expect(
    generate(
      async () =>
        '{"tasks":[{"content":"Unverified","details":"Check delivery retries.","status":"done"}]}'
    )
  ).rejects.toThrow()
  await expect(
    generate(
      async () =>
        '{"tasks":[{"content":"Unbounded","details":"Check delivery retries.","status":"pending","eta":"someday"}]}'
    )
  ).rejects.toThrow()
  await expect(
    generate(async () =>
      JSON.stringify({
        tasks: [
          {
            content: 'Backwards estimate',
            details: '- Check the result.',
            status: 'pending',
            eta: '~4–2 min'
          }
        ]
      })
    )
  ).rejects.toThrow()
  expect((await journal.reads.milestones())?.tasks[0]).toEqual({
    id: expect.any(String),
    content: 'Finish remaining work',
    details: 'Check delivery retries for issue #42.',
    status: 'in_progress',
    eta: '~2–4 min'
  })
  expect(
    await generate(async () => {
      await task(
        journal,
        'newer',
        { subject: 'Actual current scope', description: '<!-- orca-session-milestone -->' },
        'Task #1 created successfully: Actual current scope'
      )
      return '{"tasks":[{"content":"Stale result","details":"Older review.","status":"completed"}]}'
    })
  ).toEqual({ applied: false })
  expect((await journal.reads.milestones())?.tasks).toEqual([
    { id: '1', content: 'Actual current scope', status: 'pending' }
  ])
  await journal.close()
  expect((await (await open('background')).reads.milestones())?.tasks).toEqual([
    { id: '1', content: 'Actual current scope', status: 'pending' }
  ])
})

it('automatically reviews ordinary progress, preserves goal identity, and starts new work after completion', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-auto-milestones-'))
  const journal = await open('automatic')
  const record = agentSessionRecordFixture({ sessionId: 'automatic' })
  let next: { content: string; details: string; status: string; eta: string; id?: string } = {
    content: 'Finish the feature',
    details: '- Verify the result.',
    status: 'in_progress',
    eta: '~2–4 min',
    id: undefined
  }
  const review = createMilestoneReview({
    enabled: () => true,
    generate: () =>
      generateSessionMilestones({
        record,
        journal,
        generate: async () => JSON.stringify({ tasks: [next] }),
        current: () => true,
        fence: () => 0
      }),
    failed: (_id, error) => {
      throw error
    }
  })
  const release = journal.observeCommits((commit) => review.observe('automatic', journal, commit))
  const progress = async (id: string, agentId?: string) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await journal.appendItem(
      { provider: 'orca', clientMessageId: id },
      {
        kind: 'tool-call',
        name: 'exec_command',
        input: { cmd: 'check' },
        state: 'completed'
      },
      { fence: 0, turnScope: { kind: 'thread' }, ...(agentId ? { agentId } : {}) }
    )
    try {
      await vi.runOnlyPendingTimersAsync()
    } finally {
      vi.useRealTimers()
    }
    await vi.waitFor(async () => {
      expect((await journal.reads.milestones())?.tasks[0].content).toBe(next.content)
    })
  }
  try {
    await progress('edit')
    const first = (await journal.reads.milestones())!.tasks[0]
    next = { ...next, id: first.id, content: 'Deliver the feature', status: 'completed' }
    await progress('child-review', 'child-1')
    expect((await journal.reads.milestones())?.tasks[0]).toMatchObject({
      id: first.id,
      status: 'completed'
    })
    expect((await journal.reads.milestones())?.tasks[0].eta).toBeUndefined()
    next = { ...next, id: undefined, content: 'Handle the next request', status: 'pending' }
    await progress('follow-up')
    expect((await journal.reads.milestones())?.tasks[0].id).not.toBe(first.id)
  } finally {
    review.dispose()
    release()
  }
})

it('discards a background review if the person clears the conversation while it runs', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-review-clear-'))
  const journal = await open('clear-during-review')
  const result = await generateSessionMilestones({
    record: agentSessionRecordFixture({ sessionId: 'clear-during-review' }),
    journal,
    current: () => true,
    fence: () => 0,
    generate: async () => {
      await journal.appendItem(
        { provider: 'orca', clientMessageId: 'clear' },
        {
          kind: 'status',
          text: 'Cleared',
          presentation: 'context-cleared',
          contextClear: { operationId: 'clear', afterFence: 0, clearedAt: Date.now() }
        },
        { fence: 0, turnScope: { kind: 'thread' } }
      )
      return JSON.stringify({
        tasks: [
          { content: 'Old request', details: '- Stale review.', status: 'pending', eta: '~2 min' }
        ]
      })
    }
  })
  expect(result).toEqual({ applied: false })
  expect(await journal.reads.milestones()).toBeNull()
  expect(
    await generateSessionMilestones({
      record: agentSessionRecordFixture({ sessionId: 'clear-during-review' }),
      journal,
      current: () => true,
      fence: () => 0,
      generate: async () =>
        JSON.stringify({
          tasks: [
            {
              content: 'New request',
              details: '- Verify new work.',
              status: 'pending',
              eta: '~2 min'
            }
          ]
        })
    })
  ).toEqual({ applied: true })
  expect((await journal.reads.milestones())?.tasks[0].content).toBe('New request')
})

it('keeps background progress when unrelated Claude tasks change during and after review', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-native-review-'))
  const journal = await open('internal-task-progress')
  await task(
    journal,
    'milestone',
    { subject: 'Deliver feature', description: '<!-- orca-session-milestone -->' },
    'Task #1 created successfully: Deliver feature'
  )
  const result = await generateSessionMilestones({
    record: agentSessionRecordFixture({ sessionId: 'internal-task-progress' }),
    journal,
    current: () => true,
    fence: () => 0,
    generate: async () => {
      await task(
        journal,
        'ordinary',
        { subject: 'Read implementation' },
        'Task #2 created successfully: Read implementation'
      )
      return JSON.stringify({
        tasks: [
          {
            id: '1',
            content: 'Deliver feature',
            details: '- Verify the feature.',
            status: 'in_progress',
            eta: '~2 min'
          }
        ]
      })
    }
  })
  expect(result).toEqual({ applied: true })
  await task(
    journal,
    'ordinary-done',
    { taskId: '2', status: 'completed' },
    'Updated',
    'TaskUpdate'
  )
  expect((await journal.reads.milestones())?.tasks).toMatchObject([
    { id: '1', content: 'Deliver feature', status: 'in_progress' }
  ])
})

it('restores saved reviews that used the previous native revision format', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-legacy-review-'))
  const journal = await open('legacy-review')
  await task(
    journal,
    'milestone',
    { subject: 'Deliver feature', description: '<!-- orca-session-milestone -->' },
    'Task #1 created successfully: Deliver feature'
  )
  const history = await readAgentSessionHistory(journal, {
    sessionId: 'legacy-review',
    direction: 'tail',
    limit: 100
  })
  const basedOn = createHash('sha256').update(JSON.stringify(history.page.items)).digest('hex')
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'old-review' },
    {
      kind: 'status',
      text: 'Milestones regenerated.',
      presentation: 'session-milestones',
      milestonePlan: {
        basedOn,
        tasks: [{ id: 'generated-1', content: 'Deliver feature', status: 'completed' }]
      }
    },
    { fence: 0, turnScope: { kind: 'thread' } }
  )
  expect((await journal.reads.milestones())?.tasks).toMatchObject([
    { content: 'Deliver feature', status: 'completed' }
  ])
})
