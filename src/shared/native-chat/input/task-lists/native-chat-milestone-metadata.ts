import type { NativeChatTask } from './native-chat-task-list'
import { MILESTONE_ETA_PATTERN } from './native-chat-milestone-eta'

export function nativeChatMilestoneMetadata(task: NativeChatTask): NativeChatTask {
  let content = task.content
  const metadata: Partial<NativeChatTask> = {}
  for (;;) {
    const match = content.match(/\s*\[(ETA|Blocked|Waiting|Parallel|Details): ([^\]]{1,600})\]$/i)
    if (!match) {
      break
    }
    const [kind, value] = [match[1].toLowerCase(), match[2].trim()]
    if (
      (kind !== 'details' && value.length > 200) ||
      (kind === 'eta' && !MILESTONE_ETA_PATTERN.test(value))
    ) {
      break
    }
    content = content.slice(0, match.index).trim()
    if (kind === 'eta' && task.status !== 'completed') {
      metadata.eta = value
    }
    if (kind === 'details') {
      metadata.details = value
    }
    if (kind === 'parallel') {
      metadata.parallelGroup = value
    }
    if ((kind === 'blocked' || kind === 'waiting') && task.status !== 'completed') {
      metadata.blocker = { kind, reason: value }
    }
  }
  return content ? { ...task, ...metadata, content } : task
}
