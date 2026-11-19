import type { StructuredAgentSessionHostDeps } from '../agent-session-wire/host/structured-agent-session-host-types'

type Observe = NonNullable<StructuredAgentSessionHostDeps['observeCommittedRows']>

/** Coalesce progress without postponing review forever during a busy stream. */
export function createMilestoneReview(input: {
  enabled: (id: string) => boolean
  generate: (id: string) => Promise<unknown>
  failed: (id: string, error: unknown) => void
}) {
  const sessions = new Map<
    string,
    {
      timer?: ReturnType<typeof setTimeout>
      running: boolean
      working: boolean
      dirty: boolean
      lastStarted: number
    }
  >()
  let disposed = false
  const forget = (id: string) => {
    clearTimeout(sessions.get(id)?.timer)
    sessions.delete(id)
  }
  const schedule = (id: string) => {
    const state = sessions.get(id)
    if (!state || state.timer || state.running || !state.dirty || disposed) {
      return
    }
    state.timer = setTimeout(
      () => {
        state.timer = undefined
        if (sessions.get(id) !== state || !input.enabled(id)) {
          forget(id)
          return
        }
        state.dirty = false
        state.running = true
        state.lastStarted = Date.now()
        let succeeded = false
        void input
          .generate(id)
          .then(() => {
            succeeded = true
          })
          .catch((error) => input.failed(id, error))
          .finally(() => {
            state.running = false
            state.dirty ||= succeeded && state.working
            if (sessions.get(id) === state) {
              schedule(id)
            }
          })
      },
      Math.max(10_000, state.lastStarted + 120_000 - Date.now())
    )
    state.timer.unref?.()
  }
  const observe: Observe = (id, journal, commit) => {
    if (disposed || !input.enabled(id)) {
      return
    }
    if (!commit) {
      if (!sessions.has(id)) {
        sessions.set(id, { running: false, working: false, dirty: false, lastStarted: 0 })
      }
      const source = sessions.get(id)
      void Promise.all([journal.reads.milestones(), journal.reads.newestTurn()])
        .then(([list, latest]) => {
          if (
            latest?.state === 'running' &&
            sessions.get(id) === source &&
            !disposed &&
            !journal.isClosed &&
            (!list?.updatedAt || Date.now() - list.updatedAt >= 120_000)
          ) {
            mark(id)
            sessions.get(id)!.working = true
          }
        })
        .catch((error) => input.failed(id, error))
      return
    }
    for (const item of commit.publication?.items ?? []) {
      if (!item.agentId && item.body.kind === 'turn') {
        mark(id)
        sessions.get(id)!.working = item.body.state === 'running'
      }
    }
    const changed = commit.publication?.items.some(
      ({ body }) =>
        body.kind === 'turn' ||
        (body.kind === 'message' && body.state !== 'running') ||
        body.kind === 'tool-call' ||
        body.kind === 'question' ||
        body.kind === 'approval'
    )
    if (changed) {
      mark(id)
    }
  }
  const mark = (id: string) => {
    if (!sessions.has(id)) {
      sessions.set(id, { running: false, working: false, dirty: false, lastStarted: 0 })
    }
    sessions.get(id)!.dirty = true
    schedule(id)
  }
  return {
    active: () => !disposed,
    observe,
    forget,
    dispose: () => {
      disposed = true
      for (const id of sessions.keys()) {
        forget(id)
      }
    }
  }
}
