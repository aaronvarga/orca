import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AgentJournalThreadGoal } from '../../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { NativeChatMilestones } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestones'
import { useAppStore } from '@/store/index'
import { structuredChatTabById } from '@/lib/agent-session/tab-identity/structured-chat-tab-index'
import { useStructuredChatTabConversationName } from '@/runtime/native-chat/naming/structured-conversation-name'
import { AgentSessionContinuationDialog } from '@/components/agent-session-continuation/AgentSessionContinuationDialog'
import type { AgentSessionContinuationRequest } from '@/lib/agent-session/context/agent-session-continuation'
import { isTuiAgent } from '../../../../../../shared/agent-launch/catalog/tui-agent-config'
import { executionHostIdForStructuredTarget } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import type { NativeChatStructuredViewProps } from '../../native-chat-view-types'
import type { NativeChatFileLinkContext } from '../../links/actions/native-chat-file-link-context'

export type NativeChatHandOff = {
  /** This chat can seed another agent from its owning workspace. */
  available: boolean
  preparing: boolean
  open: () => void
  /** Drops a pending or open hand-off, e.g. when the conversation it describes moves on. */
  reset: () => void
  dialog: ReactNode
}

export function useNativeChatHandOff({
  pane,
  directory,
  epoch,
  goal,
  milestones
}: {
  pane: Pick<
    NativeChatStructuredViewProps,
    'tabId' | 'groupId' | 'sessionId' | 'target' | 'agent' | 'isVisible'
  >
  directory: NativeChatFileLinkContext | null
  epoch: string | null
  goal?: AgentJournalThreadGoal | null
  milestones?: NativeChatMilestones | null
}): NativeChatHandOff {
  const intentKey = JSON.stringify([
    executionHostIdForStructuredTarget(pane.target),
    pane.sessionId,
    pane.agent,
    pane.isVisible,
    epoch,
    directory
  ])
  const operationSerial = useRef(0)
  type Attempt = { key: string; operation: number; request: AgentSessionContinuationRequest }
  const active = useRef<Attempt | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const retire = useCallback(() => {
    active.current = null
    setAttempt(null)
  }, [])
  useLayoutEffect(() => {
    retire()
    return () => {
      retire()
    }
  }, [intentKey, retire])
  const chatTab = useAppStore((state) =>
    directory
      ? structuredChatTabById(state.unifiedTabsByWorktree, directory.worktreeId, pane.tabId)
      : undefined
  )
  const conversationName = useStructuredChatTabConversationName(chatTab)
  const currentAttempt = attempt === active.current && attempt?.key === intentKey ? attempt : null
  // The dialog launches in the chat's workspace, so it must be the same host the chat runs on.
  const available = Boolean(
    pane.isVisible &&
    epoch &&
    directory &&
    isTuiAgent(pane.agent) &&
    directory.runtimeEnvironmentId ===
      (pane.target.kind === 'environment' ? pane.target.environmentId : null)
  )
  const open = useCallback(() => {
    if (!available || !directory || !isTuiAgent(pane.agent) || active.current) {
      return
    }
    const prepared: Attempt = {
      key: intentKey,
      operation: ++operationSerial.current,
      request: {
        source: {
          sourceKind: 'chat',
          sourceAgent: pane.agent,
          capturedText: '',
          sourceTitle: chatTab?.customLabel?.trim() || conversationName || chatTab?.label,
          sourceWorkingDirectory: directory.worktreePath
        },
        handoffSource: {
          tabId: pane.tabId,
          sessionId: pane.sessionId,
          worktreeId: directory.worktreeId,
          progress: JSON.stringify({ goal, milestones })
        },
        worktreeId: directory.worktreeId,
        workspacePath: directory.worktreePath,
        initialCwd: directory.worktreePath,
        groupId: pane.groupId,
        launchSource: 'native_chat'
      }
    }
    active.current = prepared
    setAttempt(prepared)
  }, [
    available,
    directory,
    pane.agent,
    pane.tabId,
    pane.sessionId,
    pane.groupId,
    intentKey,
    chatTab,
    conversationName,
    goal,
    milestones
  ])
  return {
    available,
    preparing: false,
    open,
    reset: retire,
    dialog: currentAttempt ? (
      <AgentSessionContinuationDialog
        key={currentAttempt.operation}
        open
        request={currentAttempt.request}
        onOpenChange={(isOpen) => {
          if (!isOpen && active.current === currentAttempt) {
            retire()
          }
        }}
      />
    ) : null
  }
}
