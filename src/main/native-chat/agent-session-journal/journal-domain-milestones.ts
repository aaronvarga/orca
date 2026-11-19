import {
  observeMilestoneTimeline,
  type MilestoneSnapshot
} from '../../../shared/native-chat/input/task-lists/native-chat-milestone-observations'
import { readAgentJournalTurn } from '../../../shared/agent-session/lifecycle/records/agent-session-turn-record'
import { createHash } from 'node:crypto'
import type { AgentJournalRenderItem } from '../../../shared/agent-session/journal/agent-session-journal-types'
import { projectStructuredItemsToNativeChat } from '../../../shared/agent-session/view/structured-agent-session-projection'
import { nativeChatMilestones } from '../../../shared/native-chat/input/task-lists/native-chat-milestones'
import type { JournalSqlScope } from './journal-sql-scope'

export function readJournalDomainMilestones(scope: JournalSqlScope) {
  const floor = Number(
    scope.db
      .prepare(`SELECT MAX(sequence) AS sequence FROM journal_items
    INDEXED BY journal_items_context_clear WHERE session_id=? AND epoch=? AND hidden=0 AND context_clear=1`)
      .get(...scope.prefix)?.sequence ?? 0
  )
  const rows = scope.db
    .prepare(`SELECT payload_json FROM journal_items
    WHERE session_id=? AND epoch=? AND hidden=0 AND root=1 AND sequence>? AND
    (kind='turn' OR (kind='tool-call' AND json_extract(payload_json,'$.body.name') IN ('TaskCreate','TaskUpdate','TaskGet','TaskList','update_plan'))
    OR (kind='status' AND (json_extract(payload_json,'$.body.providerFrame.kind')='notification:turn/plan/updated' OR json_extract(payload_json,'$.body.milestonePlan') IS NOT NULL)))
    ORDER BY sequence,sequence_index,ordinal`)
    .all(...scope.prefix, floor)
  const items = rows.map((row) =>
    scope.decode<AgentJournalRenderItem>(scope.examined(row).payload_json)
  )
  const nativeItems = items.filter(
    (item) => item.body.kind !== 'turn' && (item.body.kind !== 'status' || !item.body.milestonePlan)
  )
  const snapshots: MilestoneSnapshot[] = []
  nativeChatMilestones(projectStructuredItemsToNativeChat(nativeItems), (list, message) => {
    if (message.timestamp === null) {
      return
    }
    snapshots.push({
      list,
      at: message.timestamp,
      sequence: message.journalPosition?.sequence ?? 0,
      index: message.journalPosition?.index ?? 0
    })
  })
  const nativeSnapshots = [...snapshots]
  const revisionOf = (snapshot: MilestoneSnapshot | undefined) =>
    snapshot
      ? createHash('sha256')
          .update(
            JSON.stringify({
              tasks: snapshot.list.tasks,
              sequence: snapshot.sequence,
              index: snapshot.index
            })
          )
          .digest('hex')
      : null
  const nativeRevision = revisionOf(nativeSnapshots.at(-1))
  for (const item of items) {
    if (item.body.kind !== 'status' || !item.body.milestonePlan) {
      continue
    }
    const revision = revisionOf(
      nativeSnapshots.findLast(
        (snapshot) =>
          snapshot.sequence < item.sequence ||
          (snapshot.sequence === item.sequence && snapshot.index < (item.sequenceIndex ?? 0))
      )
    )
    const basedOn = item.body.milestonePlan.basedOn
    // Preserve snapshots written before revisions tracked only marked milestone changes.
    const legacyRevision =
      basedOn && basedOn !== revision && revision
        ? createHash('sha256')
            .update(
              JSON.stringify(
                nativeItems.filter(
                  (entry) =>
                    entry.sequence < item.sequence ||
                    (entry.sequence === item.sequence &&
                      (entry.sequenceIndex ?? 0) < (item.sequenceIndex ?? 0))
                )
              )
            )
            .digest('hex')
        : null
    if (basedOn === revision || (legacyRevision !== null && basedOn === legacyRevision)) {
      snapshots.push({
        list: { tasks: item.body.milestonePlan.tasks },
        reviewed: true,
        at: item.observedAt,
        sequence: item.sequence,
        index: item.sequenceIndex ?? 0
      })
    }
  }
  const now = Date.now()
  const work = items.flatMap((item) => {
    const turn = readAgentJournalTurn(item.body)
    return turn?.startedAt && (turn.completedAt || turn.state === 'running')
      ? [{ start: turn.startedAt, end: turn.completedAt ?? now }]
      : []
  })
  const selected = observeMilestoneTimeline(snapshots, work, now)
  return selected ? { ...selected, ...(nativeRevision ? { nativeRevision } : {}) } : null
}
