import { useAppStore } from '@/store/index'
import { resolveCurrentCheckout } from '../current-checkout'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { terminalLaunchOpened } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab-host-agents'
import { getLaunchableWorkItemDraftContent } from '@/lib/work-items/linked-work-item-context'
import {
  directWorkItemFailureReporter,
  unavailableAgentErrorMessage
} from './launch-work-item-direct-messages'
import type { prepareDirectLaunchContext } from './launch-work-item-direct-preflight'
import { resolveDirectProspectiveAgent } from './launch-work-item-direct-preflight'
import { createNonSecureContextUuid } from '../../../../../../shared/identifiers/non-secure-context-uuid'
import type { LaunchWorkItemDirectArgs } from './launch-work-item-direct-types'
import type { DirectWorkItemLaunchResult } from './direct-work-item-setup'

type AvailableContext = Exclude<
  NonNullable<ReturnType<typeof prepareDirectLaunchContext>>,
  { unavailable: unknown }
>

export async function launchIssueInCurrentCheckout(
  args: LaunchWorkItemDirectArgs,
  context: Pick<AvailableContext, 'repo' | 'executionHostId' | 'projectContextPromise'>
): Promise<DirectWorkItemLaunchResult> {
  if (args.item.provider === 'azure-devops') {
    args.openModalFallback()
    return false
  }
  let failureAgent = args.agentOverride
  const reportFailure = directWorkItemFailureReporter(args.onFailureNotified, () => failureAgent)
  const checkout = resolveCurrentCheckout(
    selectWorktreesByRepo(useAppStore.getState())[args.repoId] ?? [],
    context.repo,
    context.executionHostId
  )
  if (!checkout) {
    return reportFailure('Current checkout is unavailable. Refresh this project and retry.')
  }
  const capturedPath = checkout.path
  const preflight = await context.projectContextPromise
  if (args.signal?.aborted) {
    return 'cancelled'
  }
  if (!preflight) {
    return reportFailure(unavailableAgentErrorMessage())
  }
  const { prospectiveAgent, unavailable } = await resolveDirectProspectiveAgent(
    useAppStore.getState(),
    context.repo,
    preflight.context,
    args
  )
  if (args.signal?.aborted) {
    return 'cancelled'
  }
  if (unavailable || !prospectiveAgent) {
    return reportFailure(unavailableAgentErrorMessage())
  }
  failureAgent = prospectiveAgent
  const prompt = await Promise.resolve(getLaunchableWorkItemDraftContent(args.item))
  if (args.signal?.aborted) {
    return 'cancelled'
  }
  const reveal = (): boolean => {
    const current = useAppStore
      .getState()
      .getKnownWorktreeById(checkout.id, context.executionHostId)
    return (
      !args.signal?.aborted &&
      current?.path === capturedPath &&
      activateAndRevealWorktree(checkout.id, {
        executionHostId: context.executionHostId,
        initialCwd: capturedPath,
        providesInitialSurface: true
      }) !== false
    )
  }
  const inputs = args.resolveLaunchInputs?.(prospectiveAgent)
  const launched = launchAgentInNewTabWithOutcome({
    requestId: createNonSecureContextUuid(),
    ...inputs,
    agent: prospectiveAgent,
    worktreeId: checkout.id,
    workspaceExecutionHostId: context.executionHostId,
    initialCwd: capturedPath,
    prompt,
    promptDelivery: args.promptDelivery ?? 'draft',
    agentArgs: inputs?.agentArgs ?? args.resolveAgentArgs?.(prospectiveAgent) ?? args.agentArgs,
    actionAgentArgs: args.actionAgentArgs,
    sessionOptions:
      inputs?.sessionOptions ??
      args.resolveSessionOptions?.(prospectiveAgent) ??
      args.sessionOptions,
    chatSessionOptions: inputs?.chatSessionOptions ?? args.chatSessionOptions,
    sessionOptionsYieldToAgentArgs: args.sessionOptionsYieldToAgentArgs,
    requestedSurface: args.launchChoice?.requestedSurface ?? inputs?.requestedSurface,
    preferredSurface: args.launchChoice?.preferredSurface ?? inputs?.preferredSurface,
    selectedExecutionHostId: args.launchChoice?.executionHostId,
    launchSource: args.launchSource,
    beforeSurfaceOpen: reveal
  })
  if (!launched || 'refused' in launched) {
    return false
  }
  args.onCreateAccepted?.()
  return await terminalLaunchOpened({ opened: true, completion: launched.terminalCompletion })
}
