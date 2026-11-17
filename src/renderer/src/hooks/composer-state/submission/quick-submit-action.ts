import { assertLinkedWorkItemCapability } from '@/runtime/workspace-links/runtime-linked-work-item-capabilities'
import { translate } from '@/i18n/i18n'
import { resolveCurrentCheckout } from '@/lib/workspace/creation/current-checkout'
import { selectWorktreesByRepo } from '@/store/workspaces/catalog/workspace-record-fields'
import { getRepoExecutionHostId } from '../../../../../shared/execution-host/execution-host'
import { useCallback } from 'react'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'
import type { WorktreeCreationRequest } from '@/lib/workspace/creation/pending-worktree-creation'
import type { QuickSubmitOptions } from './quick-creation-request'
import { findPendingLinkedWorkItemCreationId } from '@/lib/workspace/creation/pending-worktree-creation'
import { useAppStore } from '@/store/index'
import { getWorkspaceSeedName } from '@/lib/workspace/creation/new-workspace'
import { settleComposerSubmit } from '@/lib/workspace/creation/composer-submit-cancellation'
import {
  formatWorkspaceCreateError,
  getWorkspaceCreateErrorToastMessage
} from '@/lib/workspace/creation/workspace-create-error-format'
import { toast } from 'sonner'
import { scheduleComposerCreateHandoff } from '@/lib/workspace/creation/composer-create-handoff'

import type { ComposerModel } from '../composer-model'

type QuickSubmitActionInput = Pick<
  ComposerModel,
  | 'launchLocation'
  | 'baseBranch'
  | 'branchNameOverride'
  | 'linkedGitLabMR'
  | 'selectedEphemeralVmRecipeId'
  | 'selectedRepoExecutionHostId'
  | 'effectiveLinkedPR'
  | 'executeQuickCreation'
  | 'fallbackCreatureName'
  | 'isProjectGroupTarget'
  | 'isSubmissionCancelled'
  | 'linkedPR'
  | 'linkedWorkItem'
  | 'name'
  | 'onCreated'
  | 'parsedLinkedIssueNumber'
  | 'repoId'
  | 'requiresExplicitSetupChoice'
  | 'resolvePendingSmartGitHubSubmit'
  | 'selectedRepo'
  | 'selectedRepoRequiresConnection'
  | 'selectedTargetNeedsVisibleHost'
  | 'selectedWorkspaceTarget'
  | 'revealSetupChoice'
  | 'setCreateError'
  | 'setCreating'
  | 'setupDecision'
  | 'showProjectRequiredError'
  | 'sourceIntentBlocksCreate'
  | 'sparseError'
  | 'submitFolderTarget'
  | 'taskSourceContext'
  | 'telemetrySource'
>

export function useQuickSubmitAction(input: QuickSubmitActionInput) {
  const {
    launchLocation,
    baseBranch,
    branchNameOverride,
    linkedGitLabMR,
    selectedEphemeralVmRecipeId,
    selectedRepoExecutionHostId,
    effectiveLinkedPR,
    executeQuickCreation,
    fallbackCreatureName,
    isProjectGroupTarget,
    isSubmissionCancelled,
    linkedPR,
    linkedWorkItem,
    name,
    onCreated,
    parsedLinkedIssueNumber,
    repoId,
    requiresExplicitSetupChoice,
    resolvePendingSmartGitHubSubmit,
    selectedRepo,
    selectedRepoRequiresConnection,
    selectedTargetNeedsVisibleHost,
    selectedWorkspaceTarget,
    revealSetupChoice,
    setCreateError,
    setCreating,
    setupDecision,
    showProjectRequiredError,
    sourceIntentBlocksCreate,
    sparseError,
    submitFolderTarget,
    taskSourceContext,
    telemetrySource
  } = input

  const submitQuick = useCallback(
    async (requestedAgent: TuiAgent | null, options?: QuickSubmitOptions): Promise<void> => {
      if (isProjectGroupTarget) {
        await submitFolderTarget(requestedAgent, options)
        return
      }

      const currentCheckout =
        launchLocation === 'current-checkout' &&
        !effectiveLinkedPR &&
        !linkedGitLabMR &&
        !baseBranch &&
        !branchNameOverride &&
        !selectedEphemeralVmRecipeId
      const hostId =
        selectedRepoExecutionHostId ??
        (selectedRepo ? getRepoExecutionHostId(selectedRepo) : 'local')
      const checkout =
        currentCheckout && selectedRepo
          ? resolveCurrentCheckout(
              selectWorktreesByRepo(useAppStore.getState())[repoId] ?? [],
              selectedRepo,
              hostId
            )
          : null
      const capturedLocation: WorktreeCreationRequest['launchLocation'] = currentCheckout
        ? checkout
          ? { kind: 'current-checkout', worktreeId: checkout.id, path: checkout.path, hostId }
          : undefined
        : { kind: 'new-worktree' }
      if (currentCheckout && !checkout) {
        toast.error(
          translate(
            'workspace.currentCheckoutUnavailable',
            'Current checkout is unavailable. Reconnect the project and refresh its workspaces.'
          )
        )
        return
      }

      const workspaceNameSeed = getWorkspaceSeedName({
        explicitName: name,
        prompt: '',
        linkedIssueNumber: parsedLinkedIssueNumber,
        linkedPR,
        fallbackName: fallbackCreatureName
      })

      if (!repoId || !selectedRepo) {
        showProjectRequiredError()
        return
      }

      if (
        !workspaceNameSeed ||
        sourceIntentBlocksCreate ||
        selectedRepoRequiresConnection ||
        selectedTargetNeedsVisibleHost ||
        (!currentCheckout && sparseError !== null)
      ) {
        return
      }

      const workspaceRunContext: WorktreeCreationRequest['workspaceRunContext'] =
        selectedWorkspaceTarget.status === 'ready'
          ? {
              kind: 'workspace-run',
              projectId: selectedWorkspaceTarget.target.projectId,
              hostId: selectedWorkspaceTarget.target.hostId,
              projectHostSetupId: selectedWorkspaceTarget.target.projectHostSetupId,
              repoId: selectedWorkspaceTarget.target.repoId,
              path: selectedWorkspaceTarget.target.repo.path
            }
          : null

      const liveStore = useAppStore.getState()

      const pendingCreationId = findPendingLinkedWorkItemCreationId(
        liveStore.pendingWorktreeCreations,
        {
          repoId,
          launchLocation: capturedLocation,
          ...(parsedLinkedIssueNumber != null ? { linkedIssue: parsedLinkedIssueNumber } : {}),
          ...(effectiveLinkedPR != null ? { linkedPR: effectiveLinkedPR } : {}),
          workspaceRunContext
        }
      )

      if (pendingCreationId) {
        liveStore.updatePendingWorktreeCreation(pendingCreationId, { loaderVisible: true })
        liveStore.setActivePendingWorktreeCreation(pendingCreationId)
        liveStore.setActiveView('terminal')
        liveStore.setSidebarOpen(true)
        onCreated?.()
        return
      }

      if (!currentCheckout && requiresExplicitSetupChoice && !setupDecision) {
        // The Run/Skip choice lives in Advanced; reveal it rather than refuse silently.
        revealSetupChoice()
        return
      }

      try {
        await assertLinkedWorkItemCapability(hostId, {
          linkedWorkItem,
          linkedTaskSourceContext: taskSourceContext
        })
      } catch (error) {
        setCreateError(formatWorkspaceCreateError(error))
        return
      }
      if (isSubmissionCancelled()) {
        return
      }
      setCreateError(null)

      setCreating(true)
      const handoff = scheduleComposerCreateHandoff({
        stagingRequest: {
          repoId,
          launchLocation: capturedLocation,
          workspaceRunContext,
          name: workspaceNameSeed,
          ...(parsedLinkedIssueNumber != null ? { linkedIssue: parsedLinkedIssueNumber } : {}),
          ...(effectiveLinkedPR != null ? { linkedPR: effectiveLinkedPR } : {}),
          setupDecision: setupDecision ?? 'inherit',
          agent: requestedAgent,
          pendingFirstAgentMessageRename: false,
          note: '',
          startupPlan: null,
          quickPrompt: '',
          quickTelemetry: null
        },
        // Why: closing (even under "Create more") keeps a later dismiss from cancelling this submit.
        onHandOff: () => onCreated?.(),
        isCancelled: isSubmissionCancelled,
        reopenComposer: () =>
          useAppStore.getState().openModal('new-workspace-composer', {
            prefilledName: name,
            initialLaunchLocation: capturedLocation?.kind,
            initialRepoId: repoId,
            linkedWorkItem,
            taskSourceContext,
            telemetrySource
          })
      })
      try {
        const smartGitHubSettlement = await settleComposerSubmit(
          resolvePendingSmartGitHubSubmit(),
          isSubmissionCancelled
        )
        if (smartGitHubSettlement.status === 'cancelled') {
          return
        }
        await executeQuickCreation(
          smartGitHubSettlement.value,
          requestedAgent,
          workspaceNameSeed,
          workspaceRunContext,
          repoId,
          options,
          handoff,
          capturedLocation
        )
      } catch (error) {
        if (isSubmissionCancelled()) {
          return
        }
        const formattedError = formatWorkspaceCreateError(error)
        if (handoff.fail(getWorkspaceCreateErrorToastMessage(formattedError))) {
          return
        }
        setCreateError(formattedError)
        toast.error(getWorkspaceCreateErrorToastMessage(formattedError))
      } finally {
        handoff.dispose()
        setCreating(false)
      }
    },
    [
      launchLocation,
      baseBranch,
      branchNameOverride,
      linkedGitLabMR,
      selectedEphemeralVmRecipeId,
      selectedRepoExecutionHostId,
      effectiveLinkedPR,
      executeQuickCreation,
      fallbackCreatureName,
      isProjectGroupTarget,
      isSubmissionCancelled,
      linkedPR,
      linkedWorkItem,
      name,
      onCreated,
      parsedLinkedIssueNumber,
      repoId,
      requiresExplicitSetupChoice,
      resolvePendingSmartGitHubSubmit,
      selectedRepo,
      selectedRepoRequiresConnection,
      selectedTargetNeedsVisibleHost,
      selectedWorkspaceTarget,
      revealSetupChoice,
      setCreateError,
      setCreating,
      setupDecision,
      showProjectRequiredError,
      sourceIntentBlocksCreate,
      sparseError,
      submitFolderTarget,
      taskSourceContext,
      telemetrySource
    ]
  )

  return { submitQuick }
}
