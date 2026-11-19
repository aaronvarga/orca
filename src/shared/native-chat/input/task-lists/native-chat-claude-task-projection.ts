import type {
  NativeChatMessage,
  NativeChatToolCallBlock,
  NativeChatToolResultBlock
} from '../../native-chat-types'
import type { NativeChatTask } from './native-chat-task-list'
import { pairToolBlocks } from '../../tools/native-chat-tool-pairs'

type Task = NativeChatTask & { id: string; description?: string }
type Tasks = ReadonlyMap<string, Task>

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function task(value: unknown): NativeChatTask | null {
  const row = record(value)
  const content = text(row?.subject)
  const status = row?.status
  if (!content || (status !== 'pending' && status !== 'in_progress' && status !== 'completed')) {
    return null
  }
  const activeForm = text(row?.activeForm) ?? text(row?.active_form)
  return { content, status, ...(activeForm ? { activeForm } : {}) }
}

function applyTaskCall(
  tasks: Tasks,
  call: NativeChatToolCallBlock,
  result: NativeChatToolResultBlock
): Tasks {
  if (!['TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList'].includes(call.name)) {
    return tasks
  }
  const input = record(call.input)
  const output = record(result.output)
  if (output?.success === false) {
    return tasks
  }
  if (call.name === 'TaskList') {
    if (!Array.isArray(output?.tasks)) {
      return tasks
    }
    const next = new Map<string, Task>()
    for (const row of output.tasks) {
      const id = text(record(row)?.id)
      const entry = task(row)
      if (!id || !entry) {
        return tasks
      }
      next.set(id, {
        ...entry,
        id,
        description: text(record(row)?.description) ?? tasks.get(id)?.description
      })
    }
    return next
  }
  if (call.name === 'TaskCreate' || call.name === 'TaskGet') {
    const row = record(output?.task)
    const id =
      text(row?.id) ??
      (call.name === 'TaskCreate'
        ? result.output.match(/^Task #(\S+) created successfully:/)?.[1]
        : undefined)
    const entry =
      call.name === 'TaskCreate' ? task({ ...input, status: 'pending', ...row }) : task(row)
    if (!id || !entry) {
      return tasks
    }
    return new Map(tasks).set(id, {
      ...entry,
      id,
      description: text(row?.description) ?? text(input?.description) ?? tasks.get(id)?.description
    })
  }
  if (call.name !== 'TaskUpdate') {
    return tasks
  }
  const id = text(input?.taskId) ?? text(input?.id) ?? text(input?.task_id)
  if (!id || !tasks.has(id)) {
    return tasks
  }
  const next = new Map(tasks)
  if (input?.status === 'deleted') {
    next.delete(id)
    return next
  }
  const previous = tasks.get(id)!
  const entry = task({
    subject: input?.subject ?? previous.content,
    status: input?.status ?? previous.status,
    activeForm: input?.activeForm ?? input?.active_form ?? previous.activeForm
  })
  if (!entry) {
    return tasks
  }
  return next.set(id, {
    ...entry,
    id,
    description: typeof input?.description === 'string' ? input.description : previous.description
  })
}

/** Replay from the visible history; cached contexts keep unchanged rows and snapshots stable. */
export function createNativeChatClaudeTaskProjection(milestonesOnly = false) {
  const empty: Tasks = new Map()
  const cache = new WeakMap<
    NativeChatMessage,
    { before: Tasks; after: Tasks; message: NativeChatMessage }
  >()
  return (messages: readonly NativeChatMessage[]): NativeChatMessage[] => {
    let tasks = empty
    return messages.map((source) => {
      const cached = cache.get(source)
      if (cached?.before === tasks) {
        tasks = cached.after
        return cached.message
      }
      const before = tasks
      let replacements: Map<NativeChatToolCallBlock, NativeChatToolCallBlock> | undefined
      if (source.role === 'assistant') {
        for (const { call, result } of pairToolBlocks(source.blocks)) {
          if (
            !call ||
            !result ||
            result.isError ||
            call.state === 'failed' ||
            (call.state && call.state !== 'completed')
          ) {
            continue
          }
          const previous = tasks
          const next = applyTaskCall(tasks, call, result)
          if (next !== tasks) {
            tasks = next
            if (
              milestonesOnly &&
              JSON.stringify(
                [...previous.values()].filter((task) =>
                  task.description?.includes('<!-- orca-session-milestone -->')
                )
              ) ===
                JSON.stringify(
                  [...tasks.values()].filter((task) =>
                    task.description?.includes('<!-- orca-session-milestone -->')
                  )
                )
            ) {
              continue
            }
            replacements ??= new Map()
            replacements.set(call, {
              ...call,
              name: 'TodoWrite',
              input: {
                todos: [...tasks.values()]
                  .filter(
                    (task) =>
                      !milestonesOnly ||
                      task.description?.includes('<!-- orca-session-milestone -->')
                  )
                  .map(({ id, description, ...task }) => {
                    const details = milestonesOnly
                      ? description
                          ?.replace(/<!-- orca-session-milestone -->/g, '')
                          .trim()
                          .slice(0, 600)
                      : undefined
                    return milestonesOnly ? { ...task, id, ...(details ? { details } : {}) } : task
                  }),
                ...(milestonesOnly ? { explanation: 'orca-session-milestones' } : {})
              }
            })
          }
        }
      }
      const message = replacements
        ? {
            ...source,
            blocks: source.blocks.map((block) =>
              block.type === 'tool-call' ? (replacements!.get(block) ?? block) : block
            )
          }
        : source
      cache.set(source, { before, after: tasks, message })
      return message
    })
  }
}
