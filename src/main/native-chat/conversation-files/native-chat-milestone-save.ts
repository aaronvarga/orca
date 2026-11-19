import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AgentSessionJournal } from '../agent-session-journal/journal-store'
import { durableWriteTempPath, writeFileDurable } from '../../filesystem/durable-file-write'
import { observeFilePublication } from '../../filesystem/file-content-observation'
import { nativeChatScratchFolderFor } from './native-chat-scratch-folder'
import {
  nativeChatMilestonesMarkdown,
  type NativeChatMilestones
} from '../../../shared/native-chat/input/task-lists/native-chat-milestones'

/** Serialize derived writes per journal; failures keep the native snapshot and retry next update. */
export function createNativeChatMilestoneSave(stateDirectory: () => string) {
  const pending = new WeakMap<AgentSessionJournal, Promise<NativeChatMilestones | null>>()
  const states = new WeakMap<AgentSessionJournal, NativeChatMilestones | null>()
  const cache = new WeakMap<
    AgentSessionJournal,
    { cursor: string; list: NativeChatMilestones | null }
  >()
  const saved = new WeakMap<AgentSessionJournal, string>()
  return (journal: AgentSessionJournal): Promise<NativeChatMilestones | null> => {
    if (journal.identity.agent !== 'claude' && journal.identity.agent !== 'codex') {
      return Promise.resolve(null)
    }
    const prior = pending.get(journal) ?? Promise.resolve(null)
    const next = prior
      .catch(() => null)
      .then(async () => {
        const cursor = JSON.stringify(journal.cursor())
        const cached = cache.get(journal)
        if (cached?.cursor === cursor) {
          return cached.list
        }
        let list: NativeChatMilestones | null
        try {
          list = await journal.reads.milestones()
        } catch {
          return states.get(journal) ?? null
        }
        states.set(journal, list)
        if (!list) {
          cache.set(journal, { cursor, list: null })
          return null
        }
        const folder = nativeChatScratchFolderFor(stateDirectory(), journal.identity.sessionId)
        const filePath = join(folder, 'session-plan.md')
        const markdown = nativeChatMilestonesMarkdown(list)
        try {
          if (saved.get(journal) !== markdown) {
            await mkdir(folder, { recursive: true, mode: 0o700 })
            await writeFileDurable(durableWriteTempPath(filePath), filePath, markdown, 0o600)
            observeFilePublication(filePath, markdown)
            saved.set(journal, markdown)
          }
          const snapshot = { ...list, filePath }
          cache.set(journal, { cursor, list: snapshot })
          return snapshot
        } catch {
          return {
            ...list,
            filePath,
            saveError: 'Milestones could not be saved. Orca will retry on the next update.'
          }
        }
      })
    pending.set(journal, next)
    return next
  }
}
