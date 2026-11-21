import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { joinPath } from '@/lib/path'
import { parseWslUncPath, toLinuxPath } from '../../../../../shared/file-access/wsl-paths'
import { resolveWorkspaceDirectory } from '@/lib/workspace/paths/workspace-directory'
import { captureRuntimeEnvironmentRequestRevision } from '@/runtime/rpc/environment-revisions/runtime-environment-revision'
import { createNonSecureContextUuid } from '../../../../../shared/identifiers/non-secure-context-uuid'
import { discoverSkillsForRuntimeTarget } from '@/runtime/skills/configuration/runtime-skills-client'
import { readRuntimeFileContent } from '@/runtime/files/reads/runtime-file-read-client'
import { resolveNativeChatSkillDiscoveryContext } from '@/components/native-chat/composer/pickers/native-chat-skill-discovery-context'
import { agentReadsSkill } from '@/lib/skills/agent-skill-coverage'
import { executionHostIdForStructuredTarget } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { isConfirmedFileNotFoundError } from '../../../../../shared/file-write/file-write-disk-precondition'
import { sendStructuredAgentSessionMessage } from '@/components/native-chat/session/structured/delivery/structured-agent-session-message-sender'
import { sendNotesToActiveAgentSession } from '../messaging/terminal/active-agent-note-send'
import {
  completedSkillHandoff,
  publishedSkillHandoffReceipt,
  skillHandoffWritePrompt,
  skillHandoffResumePrompt
} from '../../../../../shared/agent-session/conversation-context/agent-skill-handoff'
import type { AgentSessionContinuationRequest } from './agent-session-continuation'
import type { TuiAgent } from '../../../../../shared/agent-launch/catalog/tui-agent'

const attempts = new WeakMap<
  AgentSessionContinuationRequest,
  {
    id: string
    contextKey: string
    filePath: string
    started: Promise<void>
  }
>()

export async function prepareAgentSkillHandoff(
  request: AgentSessionContinuationRequest,
  destination: TuiAgent,
  signal?: AbortSignal
): Promise<{ filePath: string; prompt: string }> {
  const source = request.handoffSource
  const sourceAgent = request.source.sourceAgent
  if (!source || !sourceAgent) {
    throw new Error(
      translate(
        'components.agentSessionContinuation.resumeSourceFirst',
        'Resume the original session before handing it off.'
      )
    )
  }
  const context = resolveNativeChatSkillDiscoveryContext(
    useAppStore.getState(),
    source.tabId,
    source.worktreeId
  )
  if (context?.executionHostKind === 'ssh') {
    throw new Error(
      translate(
        'components.agentSessionContinuation.sshNeedsRuntime',
        'Connect this SSH host through an Orca runtime to use skill handoffs.'
      )
    )
  }
  if (!context) {
    throw new Error(
      translate(
        'components.agentSessionContinuation.sourceHostUnavailable',
        'The source session’s host or working folder is unavailable.'
      )
    )
  }
  const root = resolveWorkspaceDirectory(
    useAppStore.getState(),
    source.worktreeId,
    executionHostIdForStructuredTarget(context.runtimeTarget)
  )
  if (!root) {
    throw new Error(
      translate(
        'components.agentSessionContinuation.sourceHostUnavailable',
        'The source session’s host or working folder is unavailable.'
      )
    )
  }
  const projectRuntime = context.discoveryTarget.projectRuntime
  const wsl =
    context.discoveryTarget.runtime === 'wsl' ||
    (projectRuntime?.status === 'resolved' && projectRuntime.runtime.kind === 'wsl')
  const agentPath = (path: string) =>
    wsl ? (parseWslUncPath(path)?.linuxPath ?? toLinuxPath(path)) : path
  const environmentId =
    context.runtimeTarget.kind === 'environment' ? context.runtimeTarget.environmentId : null
  const revision = environmentId
    ? captureRuntimeEnvironmentRequestRevision(environmentId)
    : undefined
  const contextKey = JSON.stringify([context.key, revision])
  const assertOwner = () => {
    if (
      resolveNativeChatSkillDiscoveryContext(
        useAppStore.getState(),
        source.tabId,
        source.worktreeId
      )?.key !== context.key ||
      (environmentId &&
        (revision === undefined ||
          captureRuntimeEnvironmentRequestRevision(environmentId) !== revision))
    ) {
      throw new Error(
        translate(
          'components.agentSessionContinuation.sourceHostUnavailable',
          'The source session’s host or working folder is unavailable.'
        )
      )
    }
  }
  assertOwner()
  const discovery = await discoverSkillsForRuntimeTarget(context.runtimeTarget, {
    ...context.discoveryTarget,
    names: ['handoff', 'handoff-resume'],
    refresh: true
  })
  const writer = discovery.skills.find(
    (skill) =>
      skill.name === 'handoff' &&
      skill.installed &&
      agentReadsSkill(sourceAgent, skill, discovery.sources, { includeRepo: true })
  )
  const resumer = discovery.skills.find(
    (skill) =>
      skill.name === 'handoff-resume' &&
      skill.installed &&
      agentReadsSkill(destination, skill, discovery.sources, { includeRepo: true })
  )
  if (!writer || !resumer) {
    throw new Error(
      translate(
        'components.agentSessionContinuation.skillsMissing',
        'Install handoff for the source agent and handoff-resume for the destination agent on this workspace host.'
      )
    )
  }
  signal?.throwIfAborted()
  assertOwner()
  let attempt = attempts.get(request)
  if (attempt && attempt.contextKey !== contextKey) {
    throw new Error(
      translate(
        'components.agentSessionContinuation.sourceHostUnavailable',
        'The source session’s host or working folder is unavailable.'
      )
    )
  }
  if (!attempt) {
    const id = createNonSecureContextUuid()
    const relativePath = `.orca/handoffs/${id}.md`
    const filePath = joinPath(agentPath(root), relativePath)
    const prompt = skillHandoffWritePrompt({
      id,
      root: agentPath(root),
      filePath,
      skillPath: agentPath(writer.skillFilePath),
      sourceSessionId: source.sessionId,
      progress: source.progress
    })
    const started = (async () => {
      if (source.sessionId) {
        const sent = sendStructuredAgentSessionMessage({
          sessionId: source.sessionId,
          target: context.runtimeTarget,
          text: prompt,
          delivery: 'queue-if-active',
          callerKeepsText: true
        })
        if (!sent || (await sent.outcome) !== 'recorded') {
          throw new Error(
            translate(
              'components.agentSessionContinuation.sourceSendFailed',
              'The source agent could not receive the handoff request. Check its session before retrying.'
            )
          )
        }
      } else if (source.terminalLeafId) {
        const sent = await sendNotesToActiveAgentSession({
          worktreeId: source.worktreeId,
          prompt,
          noteTarget: { tabId: source.tabId, leafId: source.terminalLeafId },
          submit: true
        })
        if (sent.status !== 'sent') {
          throw new Error(
            translate(
              'components.agentSessionContinuation.sourceSendFailed',
              'The source agent could not receive the handoff request. Check its session before retrying.'
            )
          )
        }
      } else {
        throw new Error(
          translate(
            'components.agentSessionContinuation.resumeSourceFirst',
            'Resume the original session before handing it off.'
          )
        )
      }
    })()
    attempt = { id, contextKey, filePath, started }
    attempts.set(request, attempt)
  }
  await attempt.started
  const { id, filePath } = attempt
  const relativePath = `.orca/handoffs/${id}.md`
  const read = async (path: string) => {
    try {
      const result = await readRuntimeFileContent({
        target: context.runtimeTarget,
        worktreeId: source.worktreeId,
        filePath: joinPath(root, path),
        relativePath: path,
        expectedEnvironmentPairingRevision: revision
      })
      return result.isBinary ? '' : result.content
    } catch (error) {
      if (isConfirmedFileNotFoundError(error)) {
        return ''
      }
      throw error
    }
  }
  const deadline = Date.now() + 10 * 60_000
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    assertOwner()
    const briefing = await read(relativePath)
    if (completedSkillHandoff(briefing, id)) {
      const receipt = await read(`.orca/handoffs/${id}.ready.json`)
      if (publishedSkillHandoffReceipt(receipt, id)) {
        signal?.throwIfAborted()
        assertOwner()
        return {
          filePath,
          prompt: skillHandoffResumePrompt(filePath, agentPath(resumer.skillFilePath))
        }
      }
    }
    signal?.throwIfAborted()
    await new Promise<void>((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(
    translate(
      'components.agentSessionContinuation.handoffTimedOut',
      'The source agent has not published a completed handoff. Check for an approval, usage limit, or error in its session; no destination was started.'
    )
  )
}
