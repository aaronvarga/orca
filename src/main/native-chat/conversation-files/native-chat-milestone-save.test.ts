import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createTrackedJournalOpener } from '../agent-session-journal/store-lifecycle/journal-host-database-test-support'
import { claudeProviderHandle } from '../../../shared/agent-session/lifecycle/provider-handles/agent-session-provider-handle-encoding'
import { createNativeChatMilestoneSave } from './native-chat-milestone-save'
import { nativeChatScratchFolderFor } from './native-chat-scratch-folder'
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
    { fence: 0, turnScope: { kind: 'thread' }, observedAt: 1000 }
  )
}

it('replays durable goals after reopen, isolates sessions and retries failed atomic saves', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-milestones-'))
  const journal = await open('first')
  await task(
    journal,
    'internal',
    { subject: 'Search files' },
    'Task #2 created successfully: Search files'
  )
  expect(await journal.reads.milestones()).toBeNull()
  await task(
    journal,
    'create',
    { subject: 'Implement', description: '<!-- orca-session-milestone -->' },
    'Task #1 created successfully: Implement'
  )
  await task(
    journal,
    'update',
    { taskId: '1', subject: 'Implement goals', status: 'in_progress' },
    'Updated',
    'TaskUpdate'
  )
  expect(await journal.reads.milestones()).toMatchObject({
    tasks: [{ id: '1', content: 'Implement goals', status: 'in_progress' }]
  })
  const folder = nativeChatScratchFolderFor(root, 'first')
  await mkdir(dirname(folder), { recursive: true })
  await writeFile(folder, 'blocked folder')
  const save = createNativeChatMilestoneSave(() => root)
  const failed = await save(journal)
  expect(failed?.tasks).toEqual([{ id: '1', content: 'Implement goals', status: 'in_progress' }])
  expect(failed?.saveError).toBeTruthy()
  await rm(folder)
  const saved = await save(journal)
  expect(saved?.saveError).toBeUndefined()
  expect(await readFile(join(folder, 'session-plan.md'), 'utf8')).toBe(
    '# Session milestones\n\n- [ ] Implement goals (current)\n'
  )
  const other = await open('second')
  expect(await save(other)).toBeNull()
  await journal.close()
  const reopened = await open('first')
  expect(await reopened.reads.milestones()).toMatchObject({
    tasks: [{ id: '1', content: 'Implement goals', status: 'in_progress' }]
  })
})

it('restores marked Codex notification snapshots independently of the loaded transcript window', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-codex-milestones-'))
  const journal = await open('codex-notifications')
  const head = JSON.stringify({
    explanation: 'orca-session-milestones',
    plan: [{ step: 'Verify recovery', status: 'inProgress' }]
  })
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'plan' },
    {
      kind: 'status',
      text: 'Plan updated',
      providerFrame: {
        provider: 'codex',
        kind: 'notification:turn/plan/updated',
        payload: { head, truncated: false, byteLength: head.length, digest: 'test' }
      }
    },
    { fence: 0, turnScope: { kind: 'thread' } }
  )
  expect(await journal.reads.milestones()).toMatchObject({
    tasks: [{ id: 'step-1', content: 'Verify recovery', status: 'in_progress' }]
  })
})

it('reconstructs measured milestone duration from durable root turns after reopening', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-milestone-timing-'))
  const journal = await open('measured')
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'turn' },
    { kind: 'turn', turnId: 'turn', state: 'completed', startedAt: 1000, completedAt: 8000 },
    { fence: 0, turnScope: { kind: 'thread' }, observedAt: 8000 }
  )
  for (const [id, at, status] of [
    ['begin', 2000, 'in_progress'],
    ['finish', 7000, 'completed']
  ] as const) {
    await journal.appendItem(
      { provider: 'orca', clientMessageId: id },
      {
        kind: 'tool-call',
        name: 'update_plan',
        callId: id,
        state: 'completed',
        input: {
          explanation: 'orca-session-milestones',
          plan: [{ step: 'Ship [ETA: ~2 min]', status }]
        }
      },
      { fence: 0, turnScope: { kind: 'thread' }, observedAt: at }
    )
  }
  expect((await journal.reads.milestones())?.tasks).toEqual([
    {
      id: 'step-1',
      content: 'Ship',
      status: 'completed',
      timing: { elapsedMs: 5000, estimate: '~2 min' }
    }
  ])
  await journal.close()
  expect((await (await open('measured')).reads.milestones())?.completedSamples).toEqual([
    { content: 'Ship', elapsedMs: 5000, estimate: '~2 min' }
  ])
})

it('does not resurrect milestones from before a cleared conversation', async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-cleared-milestones-'))
  const journal = await open('cleared')
  await task(
    journal,
    'old',
    { subject: 'Old request', description: '<!-- orca-session-milestone -->' },
    'Task #1 created successfully: Old request'
  )
  expect((await journal.reads.milestones())?.tasks[0].content).toBe('Old request')
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'clear' },
    {
      kind: 'status',
      text: 'Cleared',
      presentation: 'context-cleared',
      contextClear: { operationId: 'clear', afterFence: 0, clearedAt: 2000 }
    },
    { fence: 0, turnScope: { kind: 'thread' } }
  )
  expect(await journal.reads.milestones()).toBeNull()
})
