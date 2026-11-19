import { formatNativeChatDuration } from '../../transcript/turns/native-chat-turn-status'
import { nativeChatMilestoneMetadata } from './native-chat-milestone-metadata'
import type { NativeChatMessage } from '../../native-chat-types'
import { pairToolBlocks } from '../../tools/native-chat-tool-pairs'
import { createNativeChatClaudeTaskProjection } from './native-chat-claude-task-projection'
import { projectNativeChatTaskListFrame } from './native-chat-task-list-frames'
import { normalizeNativeChatTaskList, type NativeChatTaskList } from './native-chat-task-list'

export const SESSION_MILESTONE_MARKER = 'orca-session-milestones'
export type NativeChatMilestones = NativeChatTaskList & {
  filePath?: string
  saveError?: string
  nativeRevision?: string
  updatedAt?: number
  completedSamples?: { content: string; elapsedMs: number; estimate?: string }[]
}

/** Replay only marked root-agent events; an empty marked snapshot explicitly removes the plan. */
export function nativeChatMilestones(
  messages: readonly NativeChatMessage[],
  observe?: (list: NativeChatMilestones, message: NativeChatMessage) => void
): NativeChatMilestones | null {
  let latest: NativeChatMilestones | null = null
  let nextId = 1
  const retired = new Set<string>()
  let sourceKeys: string[] = []
  const keyOf = (task: NativeChatTaskList['tasks'][number]) => task.id ?? task.content
  const projected = createNativeChatClaudeTaskProjection(true)(
    messages.filter((message) => message.agentId === undefined).map(projectNativeChatTaskListFrame)
  )
  for (const message of projected) {
    if (message.agentId !== undefined || message.role !== 'assistant') {
      continue
    }
    for (const { call, result } of pairToolBlocks(message.blocks)) {
      if (!call || call.state !== 'completed' || result?.isError) {
        continue
      }
      let value = call.input
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value)
        } catch {
          continue
        }
      }
      const input = typeof value === 'object' && value !== null ? value : null
      if (
        !input ||
        !('explanation' in input) ||
        typeof input.explanation !== 'string' ||
        !input.explanation.includes(SESSION_MILESTONE_MARKER)
      ) {
        continue
      }
      const list = normalizeNativeChatTaskList(call.name, call.input)
      if (list) {
        const previous: NativeChatTaskList['tasks'] = latest?.tasks ?? []
        const incoming = list.tasks
          .map(nativeChatMilestoneMetadata)
          .filter((task) => !retired.has(keyOf(task)))
        if (
          previous.length &&
          previous.every((task) => task.status === 'completed') &&
          incoming.some((task) => task.status !== 'completed' && !sourceKeys.includes(keyOf(task)))
        ) {
          for (const key of sourceKeys) {
            if (!incoming.some((task) => keyOf(task) === key && task.status !== 'completed')) {
              retired.add(key)
            }
          }
        }
        const tasks = incoming.filter((task) => !retired.has(keyOf(task))).slice(0, 6)
        sourceKeys = tasks.map(keyOf)
        const matched = new Set<string>()
        const ids = tasks.map((task) => {
          const old = previous.find(
            (entry) => entry.content === task.content && entry.id && !matched.has(entry.id)
          )
          const id = task.id ?? old?.id
          if (id) {
            matched.add(id)
          }
          return id
        })
        latest = {
          tasks: tasks.map((task, index) => {
            const candidate = previous[index]?.id
            const fallback =
              candidate && !matched.has(candidate)
                ? candidate
                : previous.find((entry) => entry.id && !matched.has(entry.id))?.id
            const id = ids[index] ?? fallback ?? `step-${nextId++}`
            matched.add(id)
            return {
              ...task,
              content: task.content.slice(0, 512),
              ...(task.activeForm ? { activeForm: task.activeForm.slice(0, 512) } : {}),
              id
            }
          })
        }
        observe?.(latest, message)
      }
    }
  }
  return latest
}

export function nativeChatMilestonesMarkdown(list: NativeChatTaskList): string {
  const rows = list.tasks.map(
    (task) =>
      `- [${task.status === 'completed' ? 'x' : ' '}] ${task.content.replace(/[\r\n]+/g, ' ')}${task.status === 'in_progress' ? ' (current)' : ''}${task.blocker && task.status !== 'completed' ? ` (${task.blocker.kind === 'waiting' ? 'waiting on you' : 'blocked'}: ${task.blocker.reason.replace(/[\r\n]+/g, ' ')})` : ''}${task.eta && task.status !== 'completed' ? ` — ETA ${task.eta}` : ''}${task.status === 'completed' && task.timing ? ` — Observed ${formatNativeChatDuration(task.timing.elapsedMs / 1000)}${task.timing.estimate ? ` (estimated ${task.timing.estimate})` : ''}` : ''}`
  )
  return `# Session milestones\n\n${rows.join('\n')}\n`
}

export const SESSION_MILESTONE_DESCRIPTION_INSTRUCTIONS = `Write milestone titles and blocker reasons in STE80 Humanizer style. First remove stock AI phrases, inflated claims, vague verbs and repeated wording. Then restate each goal with plain words, an active verb and one main idea. Aim for 6 to 12 words per title and no more than 20 when the meaning fits. Keep necessary scope, conditions, uncertainty, product names, numbers and identifiers even if the title needs more words. Say what the user will get or what will work when the milestone is done. Avoid noun stacks, internal shorthand and lists of implementation details. Write for a person who does not know this codebase. Explain internal terms with the concrete actions they describe, using the conversation as evidence. Do not copy unexplained phrases such as source re-entry, supersession, usage preservation, qualify delivery or operator recovery from an old title. State what repeats, changes, stays recorded, gets checked or can be recovered. Keep required product names and identifiers. If a technical term is essential, explain it in plain words. Use simple tenses. Do not use semicolons, decorative dashes, bold text or writing-rule numbers in titles. Keep ETA units and machine-readable suffixes unchanged. When revising an existing title, preserve its goal, order and status. Clearer wording does not mean more work is complete. Before returning each title, check that a reader unfamiliar with the implementation can understand its action and outcome without reading the earlier chat.`

export const SESSION_MILESTONE_INSTRUCTIONS = `Maintain the chat's main goals or approved implementation phases as native milestones throughout this session. At startup/resume and each normal user request, create or revise 3–6 plain-language milestones for substantial work (fewer for simple work; at most six). These are user goals, not internal tasks, tool calls or individual file edits. ${SESSION_MILESTONE_DESCRIPTION_INSTRUCTIONS} For every unfinished milestone estimate YOUR remaining wall-clock execution time as the AI agent, never human developer effort or person-hours. Include expected tool/model latency, implementation, likely iterations and verification, excluding time spent on earlier milestones or waiting for user decisions. Calibrate estimates to your own observed execution pace and prior measured results when available. Use a rough range when uncertain and revise it as work progresses. Append [ETA: ~2–4 min] to each unfinished milestone subject/step (format: optional ~, number or range, then s, min or h). Remove the suffix when complete. Mark independent milestones that can actually execute concurrently with the same [Parallel: group-name] suffix; different groups and ungrouped milestones are sequential. For blocked work append [Blocked: concise reason]; when awaiting a user decision append [Waiting: concise question] and use the native question tool so the user can answer it. Remove these markers when resolved. Give each milestone a brief technical note as Markdown bullets, one point per line. Use one to three bullets about its implementation scope, constraints or checks, using only known facts. These are explanatory notes, not separately tracked subtasks. Keep the plain title separate. In the technical note, cite relevant work items, issues or pull requests by their exact known IDs and titles. Add a URL in parentheses only if the conversation already provides it. Do not search for or invent references. Claude: put this technical note in the Task description beside the required marker. Codex: append [Details: brief technical note] to the step, after the other suffixes. Keep the note under 600 characters and avoid square brackets within it. Identify the current milestone, and complete one only after finishing and checking it. Revise milestones when scope changes. Once all milestones are complete, a new substantial request starts a fresh batch for the new work; do not keep appending goals to the completed batch. Related follow-ups may reopen or revise existing milestones. Completed batches remain in the conversation history. Before your final response reconcile them with actual outcomes; unfinished or blocked work stays incomplete. Claude: use TaskCreate/TaskUpdate, retaining <!-- orca-session-milestone --> in each milestone description. Codex: use update_plan with orca-session-milestones in every plan explanation; preserve step ordering/identity across updates. Ordinary tasks may coexist without these markers. Orca saves session-plan.md from native events; do not write that file yourself. Do not start extra turns for milestone reminders.`
