import { useState } from 'react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { RepositoryIconTabs } from '@/components/settings/repository/identity/RepositoryIconTabs'
import { RepositoryIconColorSection } from '@/components/settings/repository/identity/RepositoryIconColorSection'
import { RepoIconGlyph } from '@/components/repo/repo-icon'
import type { ProjectGroup } from '../../../../shared/project/groups/project-group-types'
import { getRepoExecutionHostId } from '../../../../shared/execution-host/execution-host'

export function FolderGroupAppearanceDialog({
  group,
  onClose
}: {
  group: ProjectGroup
  onClose: () => void
}) {
  const t = useTranslate()
  const [icon, setIcon] = useState(group.repoIcon ?? null)
  const [color, setColor] = useState(group.color ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setPending(true)
    setError(null)
    await useAppStore
      .getState()
      .updateProjectGroup(
        group.id,
        { repoIcon: icon, color: color || null },
        { hostId: getRepoExecutionHostId(group) }
      )
      .then((saved) => {
        if (saved) {
          onClose()
        } else {
          setError(
            t(
              'sidebar.folderGroupAppearanceFailed',
              "Couldn't save the group appearance. Its host may need an Orca update."
            )
          )
        }
      })
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
          <DialogTitle>{t('sidebar.folderGroupAppearance', 'Group icon and color')}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <RepoIconGlyph
            repoIcon={icon}
            color={color || undefined}
            className="size-10 shrink-0"
            iconClassName="size-8"
          />
          <span className="text-sm font-medium">{group.name}</span>
        </div>
        <RepositoryIconColorSection badgeColor={color} onBadgeColorChange={setColor} />
        <RepositoryIconTabs
          initialTab={icon?.type === 'emoji' ? 'emoji' : 'icon'}
          selectedLucideName={icon?.type === 'lucide' ? icon.name : null}
          selectedEmoji={icon?.type === 'emoji' ? icon.emoji : ''}
          selectedSymbolName={
            icon?.type === 'image' && icon.source === 'symbol' ? icon.label : null
          }
          loadingGitHub={false}
          onSetIcon={setIcon}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button disabled={pending} onClick={() => void save()}>
            {t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
