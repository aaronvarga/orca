import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import type { NewWorkspaceComposerCardProps } from './new-workspace-composer-card-props'

type Props = Pick<
  NewWorkspaceComposerCardProps,
  | 'launchLocation'
  | 'onLaunchLocationChange'
  | 'selectedRepoIsGit'
  | 'selectedRepoPath'
  | 'checkoutBranch'
>

export function CheckoutLocationField({
  launchLocation,
  onLaunchLocationChange,
  selectedRepoIsGit,
  selectedRepoPath,
  checkoutBranch
}: Props) {
  const t = useTranslate()
  if (!onLaunchLocationChange) {
    return null
  }
  return (
    <div className="space-y-1">
      <Select value={launchLocation} onValueChange={onLaunchLocationChange}>
        <SelectTrigger
          aria-label={t('workspace.launchLocation', 'Launch location')}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="current-checkout">
            {t('workspace.currentCheckout', 'Current checkout')}
          </SelectItem>
          {selectedRepoIsGit ? (
            <SelectItem value="new-worktree">
              {t('workspace.newIsolatedWorktree', 'New isolated worktree')}
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {launchLocation === 'current-checkout' ? (
        <p
          className="truncate font-mono text-xs text-muted-foreground"
          title={selectedRepoPath ?? undefined}
        >
          {selectedRepoPath}
          {checkoutBranch ? ` · ${checkoutBranch}` : ''}
        </p>
      ) : null}
    </div>
  )
}
