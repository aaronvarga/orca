import { useAppStore } from '@/store'
import { captureTerminalDropTransportOwner } from '../input/file-drop/terminal-drop-transport-owner'
import {
  resolveTerminalDropWorktreePath,
  joinRuntimeTerminalDropDir
} from '../input/file-drop/terminal-drop-worktree-path'
import { resolveTerminalDropTargetShell } from '../input/file-drop/terminal-drop-shell'
import { resolveWorktreeOperationRouteResultForHost } from '@/lib/workspace/ownership/worktree-operation-route'
import { importExternalPathsToRuntime } from '@/runtime/files/imports/runtime-file-import-client'
import { runtimeTargetForOwnerEnvironment } from '@/runtime/rpc/targets/runtime-client-target'
import { shellEscapePath } from '../../../../../shared/shell/launch/shell-path-quoting'
import {
  formatImageDropPasteText,
  isImageDropPath
} from '../../../../../shared/terminal/input/image-path-paste'
import type { ExecutionHostId } from '../../../../../shared/execution-host/execution-host'

export type TerminalComposerTarget = { worktreeId: string; executionHostId: ExecutionHostId }
export type TerminalComposerAttachment = { path: string; text: string }

export async function prepareTerminalComposerFiles(
  target: TerminalComposerTarget,
  paths: string[]
): Promise<TerminalComposerAttachment[]> {
  if (!paths.length) {
    return []
  }
  const route = resolveWorktreeOperationRouteResultForHost(
    useAppStore.getState(),
    target.worktreeId,
    target.executionHostId
  )
  if (route.kind !== 'resolved') {
    throw new Error('Workspace host is unavailable.')
  }
  const owner = captureTerminalDropTransportOwner({
    getExecutionHostId: () => target.executionHostId,
    getRuntimeEnvironmentId: () => route.route.runtimeEnvironmentId
  })
  if (!owner) {
    throw new Error('Workspace host is unavailable.')
  }
  const { assertCurrent: assertOwnerCurrent, ...destination } = owner
  const assertCurrent = () => {
    assertOwnerCurrent()
    const current = resolveWorktreeOperationRouteResultForHost(
      useAppStore.getState(),
      target.worktreeId,
      target.executionHostId
    )
    if (
      current.kind !== 'resolved' ||
      current.route.runtimeEnvironmentId !== owner.runtimeEnvironmentId
    ) {
      throw new Error('Workspace host changed. Attach the files again.')
    }
  }
  const worktreePath = resolveTerminalDropWorktreePath(
    target.worktreeId,
    undefined,
    owner.executionHostId,
    owner.runtimeEnvironmentId
  )
  if (!worktreePath) {
    throw new Error('Workspace directory is unavailable.')
  }
  let resolvedPaths: string[]
  if (owner.runtimeEnvironmentId) {
    const { results } = await importExternalPathsToRuntime(
      {
        target: runtimeTargetForOwnerEnvironment(owner.runtimeEnvironmentId),
        worktreeId: target.worktreeId,
        worktreePath,
        ...destination,
        connectionId: owner.connectionId ?? undefined
      },
      paths,
      joinRuntimeTerminalDropDir(worktreePath),
      { assertCurrent, nameExtensionlessImages: true }
    )
    if (results.some((result) => result.status !== 'imported')) {
      throw new Error('Some attachments could not be uploaded. Attach those files again.')
    }
    resolvedPaths = results.flatMap((result) =>
      result.status === 'imported' ? [result.destPath] : []
    )
  } else {
    const result = await window.api.fs.resolveDroppedPathsForAgent({
      paths,
      worktreePath,
      ...destination,
      connectionId: owner.connectionId ?? undefined
    })
    if (result.failed.length || result.skipped.length) {
      throw new Error('Some attachments could not be prepared. Attach those files again.')
    }
    resolvedPaths = result.resolvedPaths
  }
  assertCurrent()
  const shell = resolveTerminalDropTargetShell({
    activeRuntimeEnvironmentId: owner.runtimeEnvironmentId,
    worktreePath,
    connectionId: owner.connectionId
  })
  return resolvedPaths.map((path) => ({
    path,
    text: isImageDropPath(path)
      ? (formatImageDropPasteText(path, shell) ?? shellEscapePath(path, shell))
      : shellEscapePath(path, shell)
  }))
}
