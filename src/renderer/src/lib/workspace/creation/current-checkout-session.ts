import { assertLinkedWorkItemCapability } from '@/runtime/workspace-links/runtime-linked-work-item-capabilities'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/rpc/targets/runtime-client-target'
import { openNewTerminalTabInWorkspace } from '@/store/terminals/tabs/creation/terminal-active-workspace-creation'
import { useAppStore } from '@/store/index'
import { activateAndRevealWorktree } from '../activation/worktree-activation'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { terminalLaunchOpened } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session/launch/routing/agent-session-launch-plan'
import { launchStructuredWorktreeSession } from './worktree-creation-structured-session'
import { normalizeRuntimePathForComparison } from '../../../../../shared/file-access/cross-platform-path'
import type { WorktreeCreationRequest } from './pending-worktree-creation'

export async function launchCurrentCheckoutSession(
  creationId: string,
  request: WorktreeCreationRequest
): Promise<void> {
  const location = request.launchLocation
  if (location?.kind !== 'current-checkout') {
    return
  }
  const store = useAppStore.getState()
  if (!store.pendingWorktreeCreations[creationId]) {
    return
  }
  const checkout = store.getKnownWorktreeById(location.worktreeId, location.hostId)
  if (
    !checkout ||
    checkout.repoId !== request.repoId ||
    normalizeRuntimePathForComparison(checkout.path) !==
      normalizeRuntimePathForComparison(location.path)
  ) {
    throw new Error('The selected checkout is unavailable. Reconnect its host and retry.')
  }
  const isCancelled = (): boolean => !useAppStore.getState().pendingWorktreeCreations[creationId]
  const target = ipcOrRuntimeTargetForHostId(location.hostId)
  if (!target) {
    throw new Error('The selected host is unavailable.')
  }
  await assertLinkedWorkItemCapability(target, request)
  if (isCancelled()) {
    return
  }
  if (request.linkedWorkItem?.provider === 'azure-devops') {
    const linked = await store.updateWorktreeMeta(
      checkout.id,
      {
        linkedWorkItem: request.linkedWorkItem,
        linkedTaskSourceContext: request.linkedTaskSourceContext
      },
      { executionHostId: location.hostId }
    )
    if (!linked.ok) {
      throw new Error(linked.error)
    }
  }
  if (isCancelled()) {
    return
  }
  const reveal = (): boolean =>
    !isCancelled() &&
    activateAndRevealWorktree(checkout.id, {
      executionHostId: location.hostId,
      initialCwd: location.path,
      providesInitialSurface: true,
      worktreeCreationId: creationId
    }) !== false
  if (request.agentLaunchRoute === 'structured-native-chat' && request.agent) {
    const result = await launchStructuredWorktreeSession({
      creationId,
      request,
      worktreeId: checkout.id,
      agentLaunchRoute: 'structured-native-chat',
      shouldActivateOnCompletion: false,
      activation: false,
      primaryTabId: null
    })
    if (result.cancelled || result.retainedInput) {
      return
    }
    if (!result.primaryTabId) {
      throw new Error('The session could not open. Retry to keep working in this checkout.')
    }
    reveal()
  } else if (request.agent) {
    const result = launchAgentInNewTabWithOutcome({
      ...request.launchInputs,
      agent: request.agent,
      worktreeId: checkout.id,
      workspaceExecutionHostId: location.hostId,
      initialCwd: location.path,
      prompt: request.launchDraftPrompt ?? request.quickPrompt,
      promptDelivery: request.promptDelivery,
      beforeSurfaceOpen: reveal,
      agentSessionLaunchPlan: adoptAgentSessionLaunchVerdict({
        route: 'terminal-tui',
        requestId: creationId,
        agent: request.agent,
        worktreeId: checkout.id,
        executionHostId: location.hostId,
        prompt: request.launchDraftPrompt ?? request.quickPrompt,
        promptDelivery: request.promptDelivery
      })
    })
    if (
      !result ||
      'refused' in result ||
      !(await terminalLaunchOpened({ opened: true, completion: result.terminalCompletion }))
    ) {
      if (!isCancelled()) {
        throw new Error('The session could not start. Retry in this checkout.')
      }
      return
    }
  } else {
    if (!reveal()) {
      return
    }
    await openNewTerminalTabInWorkspace(useAppStore.getState, checkout.id)
  }
  useAppStore.getState().removePendingWorktreeCreation(creationId, { cleanupVm: false })
}
