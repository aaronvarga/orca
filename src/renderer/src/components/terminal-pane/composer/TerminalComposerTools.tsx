import { useAppStore } from '@/store'
import { useRef, useState } from 'react'
import { isWebClientLocation } from '@/app-shell/platform/web-client-location'
import { Paperclip, Scan, SquareTerminal, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslate } from '@/i18n/use-translate'
import { getShortcutPlatform } from '@/lib/keyboard/shortcut-platform'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTerminalQuickCommandHosts } from '@/hooks/use-terminal-quick-command-hosts'
import { getRepoIdFromWorktreeId } from '../../../../../shared/worktree/id'
import type { TerminalComposerTarget } from './terminal-composer-files'

function Tool({
  label,
  Icon,
  onClick,
  disabled
}: {
  label: string
  Icon: LucideIcon
  onClick: () => void
  disabled: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function TerminalComposerTools({
  target,
  disabled,
  onAttach,
  onInsert
}: {
  target?: TerminalComposerTarget
  disabled: boolean
  onAttach: (paths: string[]) => Promise<void>
  onInsert: (text: string) => void
}) {
  const t = useTranslate()
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const unavailable = disabled || busy
  const screenshotAvailable = typeof window.api.shell.captureScreenshot === 'function'
  const { hosts } = useTerminalQuickCommandHosts(target?.worktreeId ?? '', Boolean(target))
  const repoId = target ? getRepoIdFromWorktreeId(target.worktreeId) : null
  const commands = hosts
    .filter((host) => host.hostId === target?.executionHostId)
    .flatMap((host) => host.commands)
    .filter(
      (command) =>
        !command.scope || command.scope.type === 'global' || command.scope.repoId === repoId
    )
  const run = (action: () => Promise<void>) => {
    if (pending.current) {
      return
    }
    pending.current = true
    setBusy(true)
    void action()
      .catch((error) =>
        toast.error(
          error instanceof Error
            ? error.message
            : t('terminalComposer.attachFailed', 'Could not attach files.')
        )
      )
      .finally(() => {
        pending.current = false
        setBusy(false)
      })
  }
  return (
    <>
      <Tool
        label={t('terminalComposer.attach', 'Attach file')}
        Icon={Paperclip}
        disabled={unavailable || !target}
        onClick={() => run(async () => onAttach(await window.api.shell.pickAttachments()))}
      />
      {getShortcutPlatform() === 'darwin' && !isWebClientLocation() ? (
        <Tool
          label={
            screenshotAvailable
              ? t('terminalComposer.screenshot', 'Capture screenshot')
              : t('terminalComposer.screenshotRestart', 'Restart Orca to enable screenshot capture')
          }
          Icon={Scan}
          disabled={unavailable || !target}
          onClick={() =>
            run(async () => {
              if (!screenshotAvailable) {
                toast.info(
                  t(
                    'terminalComposer.screenshotRestart',
                    'Restart Orca to enable screenshot capture'
                  )
                )
                return
              }
              const path = await window.api.shell.captureScreenshot()
              if (path) {
                await onAttach([path])
              }
            })
          }
        />
      ) : null}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t('terminalComposer.quickCommands', 'Quick commands')}
                disabled={unavailable}
              >
                <SquareTerminal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('terminalComposer.quickCommands', 'Quick commands')}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start">
          {commands.length ? (
            commands.map((command) => (
              <DropdownMenuItem
                key={command.id}
                onSelect={() =>
                  onInsert(command.action === 'agent-prompt' ? command.prompt : command.command)
                }
              >
                {command.label}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              {t('terminalComposer.noQuickCommands', 'No quick commands')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              useAppStore.getState().openSettingsTarget({ pane: 'quick-commands', repoId: null })
            }
          >
            {t('terminalComposer.manageQuickCommands', 'Manage quick commands…')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
