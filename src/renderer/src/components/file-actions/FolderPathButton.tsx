import { Folder } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { getOpenInLocalFileManagerLabel } from '@/lib/files/os-open/local-file-manager-label'
import { basename } from '@/lib/path'
import {
  getLocalPathOpenOwnerHostId,
  isLocalPathOpenBlocked,
  showLocalPathOpenBlockedToast,
  type LocalPathOpenOwner
} from '@/lib/files/os-open/local-path-open-guard'

export function FolderPathButton({
  path,
  owner,
  showPath = false
}: {
  path: string
  owner: LocalPathOpenOwner
  showPath?: boolean
}) {
  const t = useTranslate()
  const label = getOpenInLocalFileManagerLabel()
  const folderStart = Math.max(0, path.lastIndexOf(basename(path)) - 1)
  const openFolder = async (): Promise<void> => {
    const hostId = getLocalPathOpenOwnerHostId(owner)
    if (hostId === 'unresolved' || isLocalPathOpenBlocked(owner)) {
      showLocalPathOpenBlockedToast()
      return
    }
    try {
      if (await window.api.shell.openFilePath(path, hostId)) {
        return
      }
    } catch {
      // Report transport and OS launch failures through the same action.
    }
    toast.error(t('fileActions.openFolderFailed', 'Could not open folder.'))
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={showPath ? 'xs' : 'icon-xs'}
          className="max-w-64"
          aria-label={`${label} · ${path}`}
          onClick={() => void openFolder()}
        >
          <Folder className="size-3.5" />
          {showPath ? (
            <span className="flex min-w-0">
              <span className="truncate">{path.slice(0, folderStart)}</span>
              <span className="max-w-full shrink-0 truncate">{path.slice(folderStart)}</span>
            </span>
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label} · {path}
      </TooltipContent>
    </Tooltip>
  )
}
