import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { isWindowsAbsolutePathLike } from '../../../../shared/file-access/cross-platform-path'
import { useState } from 'react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { basename } from '@/lib/path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { browseRuntimeServerDirectory } from '@/runtime/files/reads/runtime-server-directory-browser'
import {
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../shared/execution-host/execution-host'

async function saveFolderGroupDirectory(
  path: string,
  name: string,
  hostId: ExecutionHostId,
  t: ReturnType<typeof useTranslate>,
  group?: ProjectGroup
): Promise<void> {
  const owner = parseExecutionHostId(hostId)
  let folderPath = path.trim()
  if (owner?.kind === 'runtime') {
    folderPath = (await browseRuntimeServerDirectory(owner.environmentId, folderPath)).resolvedPath
  } else if (owner?.kind === 'local' || (group && owner?.kind === 'ssh')) {
    if (!folderPath.startsWith('/') && !isWindowsAbsolutePathLike(folderPath)) {
      throw new Error(
        t('sidebar.folderGroupAbsolutePath', 'Enter an absolute folder path or use Browse.')
      )
    }
    await window.api.fs.readDir({
      dirPath: folderPath,
      ...(owner.kind === 'ssh' ? { connectionId: owner.targetId } : {})
    })
  } else {
    throw new Error(
      t('sidebar.folderGroupUnsupportedHost', 'Reconnect this host to create a folder group.')
    )
  }
  if (group) {
    const saved = await useAppStore
      .getState()
      .updateProjectGroup(group.id, { parentPath: folderPath }, { hostId })
    if (!saved) {
      throw new Error(
        t(
          'sidebar.folderGroupRootSaveFailed',
          "Couldn't save the root folder. Reconnect the group's host or update Orca on that host."
        )
      )
    }
    return
  }
  const created = await useAppStore
    .getState()
    .createProjectGroup(
      name.trim() || basename(folderPath) || t('sidebar.folderGroupDefaultName', 'Folder group'),
      hostId,
      folderPath
    )
  if (!created) {
    throw new Error(t('sidebar.folderGroupCreateFailed', "Couldn't create the folder group."))
  }
}

export function FolderGroupDirectoryDialog({
  hostId,
  group,
  onClose
}: {
  hostId: ExecutionHostId
  group?: ProjectGroup
  onClose: () => void
}) {
  const t = useTranslate()
  const [path, setPath] = useState(group?.parentPath ?? '')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const owner = parseExecutionHostId(hostId)
  const create = async () => {
    setPending(true)
    setError(null)
    await saveFolderGroupDirectory(path, name, hostId, t, group)
      .then(onClose)
      .catch((error: unknown) => setError(error instanceof Error ? error.message : String(error)))
      .finally(() => setPending(false))
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {group
              ? t('sidebar.folderGroupChangeRoot', 'Change root folder')
              : t('sidebar.newFolderGroup', 'New folder group')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'sidebar.folderGroupDescription',
              'Choose a parent folder. Browse its subfolders from the sidebar and choose which session to start.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void create()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="folder-group-path">
              {t('sidebar.folderGroupPath', 'Parent folder')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="folder-group-path"
                value={path}
                onChange={(event) => setPath(event.target.value)}
                disabled={pending}
                autoFocus
              />
              {owner?.kind === 'local' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    void window.api.repos
                      .pickFolder()
                      .then((value) => {
                        if (value) {
                          setPath(value)
                        }
                      })
                      .catch((error) => setError(String(error)))
                  }}
                >
                  {t('sidebar.browseFolderGroup', 'Browse…')}
                </Button>
              ) : null}
            </div>
          </div>
          {!group ? (
            <div className="space-y-2">
              <Label htmlFor="folder-group-name">{t('sidebar.folderGroupName', 'Name')}</Label>
              <Input
                id="folder-group-name"
                value={name}
                placeholder={basename(path)}
                onChange={(event) => setName(event.target.value)}
                disabled={pending}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
              {t('sidebar.folderGroupCancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={!path.trim() || pending}>
              {group ? t('common.save', 'Save') : t('sidebar.folderGroupCreate', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
