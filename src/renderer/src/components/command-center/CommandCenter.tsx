import NativeChatView from '@/components/native-chat/NativeChatView'
import { useCommandCenterChatSessions } from './use-command-center-chat-sessions'
import { openCommandCenterChat, closeCommandCenterChat } from './command-center-chat-actions'
import { getProjectRailStatus } from '../sidebar/project-rail-status'
import { useCallback, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useTerminalInventory } from '@/lib/terminal-inventory/use-terminal-inventory'
import {
  openSessionInProject,
  requestEndSession
} from '@/lib/terminal-inventory/command-center-session-actions'
import { AgentTerminalPreview } from '../dashboard/terminal-preview/AgentTerminalPreview'
import {
  getRepoExecutionHostId,
  parseExecutionHostId
} from '../../../../shared/execution-host/execution-host'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { CommandCenterView, type CommandCenterTile } from './CommandCenterView'

const collapsedByProfile = new Map<string, ReadonlySet<string>>()

export default function CommandCenter() {
  const profile = useAppStore((s) => s.activeOrcaProfileId) ?? 'default'
  return <ProfileCommandCenter key={profile} profile={profile} />
}

function ProfileCommandCenter({ profile }: { profile: string }) {
  const { sessions, refresh, refreshing } = useTerminalInventory()
  const presentation = useAppStore((s) => s.commandCenterPresentation)
  const setPresentation = useAppStore((s) => s.setCommandCenterPresentation)
  const repos = useAppStore((s) => s.repos)
  const groups = useAppStore((s) => s.projectGroups)
  const registry = useAppStore((s) => s.runtimeEnvironments)
  const statusState = useAppStore(
    useShallow((s) => ({
      unreadAgentCompletionPanes: s.unreadAgentCompletionPanes,
      terminalLayoutsByTabId: s.terminalLayoutsByTabId,
      agentStatusByPaneKey: s.agentStatusByPaneKey,
      agentStatusEpoch: s.agentStatusEpoch
    }))
  )
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => collapsedByProfile.get(profile) ?? new Set()
  )
  const [focusedChatId, setFocusedChatId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const act = useCallback((operation: Promise<void>) => {
    setError(null)
    void operation.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])
  const tiles: CommandCenterTile[] = sessions.map((session) => {
    const projectGroup = groups.find(
      (group) =>
        group.id === session.projectGroupId &&
        getRepoExecutionHostId(group) === (session.projectOwnerId ?? session.ownerId)
    )
    return {
      ...session,
      repo: repos.find(
        (r) =>
          r.id === session.repoId &&
          getRepoExecutionHostId(r) === (session.projectOwnerId ?? session.ownerId)
      ),
      projectName: projectGroup?.name,
      projectColor: projectGroup?.color,
      projectIcon: projectGroup?.repoIcon,
      hostLabel:
        session.route.target.kind === 'environment'
          ? (registry.find(
              (r) =>
                session.route.target.kind === 'environment' &&
                r.id === session.route.target.environmentId
            )?.name ?? session.ownerId)
          : session.ownerId,
      activity: getProjectRailStatus([session], statusState)
    }
  })
  const chats = useCommandCenterChatSessions()
  return (
    <CommandCenterView
      sessions={[
        ...tiles,
        ...chats.map((session) => ({
          ...session,
          activity: getProjectRailStatus([session], statusState)
        }))
      ]}
      presentation={presentation}
      onChange={setPresentation}
      onBack={() => useAppStore.getState().closeCommandCenter()}
      onRefresh={() => act(refresh())}
      refreshing={refreshing}
      error={error}
      onOpen={(session) =>
        act(
          session.kind === 'chat' ? openCommandCenterChat(session) : openSessionInProject(session)
        )
      }
      onEnd={(session) =>
        act(session.kind === 'chat' ? closeCommandCenterChat(session) : requestEndSession(session))
      }
      collapsed={collapsed}
      onCollapse={(id) => {
        const next = new Set(collapsed)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        collapsedByProfile.set(profile, next)
        setCollapsed(next)
      }}
      renderTerminal={(session) =>
        session.kind === 'chat' ? (
          <div
            className="flex min-h-0 flex-1"
            onFocusCapture={() => setFocusedChatId(session.id)}
            onPointerDownCapture={() => setFocusedChatId(session.id)}
          >
            <NativeChatView
              {...session.chat}
              groupId={undefined}
              isFocusedGroup={focusedChatId === session.id}
            />
          </div>
        ) : (
          <div
            className="flex min-h-0 flex-1"
            onFocusCapture={() => {
              setFocusedChatId(null)
              const state = useAppStore.getState()
              const key = makePaneKey(session.terminal.tabId, session.terminal.leafId)
              if (
                state.terminalLayoutsByTabId[session.terminal.tabId]?.ptyIdsByLeafId?.[
                  session.terminal.leafId
                ] === session.previewPtyId &&
                state.agentStatusByPaneKey.get(key)?.worktreeId === session.terminal.worktreeId
              ) {
                state.acknowledgeAgents([key])
              }
            }}
          >
            <AgentTerminalPreview
              composerSessionKey={JSON.stringify([
                session.terminal.worktreeId,
                session.terminal.tabId,
                session.terminal.leafId
              ])}
              ptyId={session.previewPtyId}
              viewerId={`command-center:${profile}:${session.id}`}
              incarnationId={session.terminal.incarnationId ?? undefined}
              interactive={session.available}
              claimOnMount
              scaleToFit={false}
              terminalInput={session.terminalInput}
              className="h-auto min-h-0 flex-1"
              onRequestClose={() => act(requestEndSession(session))}
              linkSource={{
                worktreeId: session.terminal.worktreeId,
                executionHostId: parseExecutionHostId(session.projectOwnerId ?? session.ownerId)
                  ?.id,
                tabId: session.terminal.tabId,
                ptyId: session.previewPtyId
              }}
            />
          </div>
        )
      }
    />
  )
}
