import { useNativeChatMilestonePreferences } from './use-native-chat-milestone-preferences'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { Files, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'

const MilestoneVisibility = createContext<{
  shown: boolean
  toggle: () => void
  composerSlot: HTMLDivElement | null
  setComposerSlot: (slot: HTMLDivElement | null) => void
  panel: ReturnType<typeof useNativeChatMilestonePreferences>
} | null>(null)

export function NativeChatMilestoneVisibilityProvider({
  children,
  enabled = true,
  sessionId
}: {
  children: ReactNode
  enabled?: boolean
  sessionId?: string
}) {
  const panel = useNativeChatMilestonePreferences(sessionId)
  const [composerSlot, setComposerSlot] = useState<HTMLDivElement | null>(null)
  const value = useMemo(
    () =>
      enabled
        ? {
            shown: panel.preferences.shown,
            toggle: () => panel.change({ shown: !panel.preferences.shown }),
            composerSlot,
            setComposerSlot,
            panel
          }
        : null,
    [enabled, panel, composerSlot]
  )

  return <MilestoneVisibility value={value}>{children}</MilestoneVisibility>
}

export function useNativeChatMilestoneVisibility() {
  return useContext(MilestoneVisibility)
}

export function NativeChatMilestoneToggle() {
  const visibility = useNativeChatMilestoneVisibility()
  const t = useTranslate()
  if (!visibility) {
    return null
  }
  const resourcesShown = visibility.shown && visibility.panel.preferences.view === 'resources'
  const progressShown =
    visibility.shown &&
    (visibility.panel.preferences.view === 'milestones' ||
      visibility.panel.preferences.view === 'agents')
  const label = progressShown
    ? t('components.native-chat.milestones.hide', 'Hide milestones')
    : t('components.native-chat.milestones.show', 'Show milestones')
  return (
    <div className="inline-flex shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={progressShown ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={label}
            aria-pressed={progressShown}
            onClick={() =>
              visibility.panel.preferences.view === 'resources' ||
              visibility.panel.preferences.view === 'questions'
                ? visibility.panel.change({ shown: true, view: 'milestones', expanded: true })
                : visibility.toggle()
            }
            onMouseDown={(event) => event.preventDefault()}
            className="pointer-coarse:size-11"
          >
            <ListChecks className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {label}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={resourcesShown ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={t('components.native-chat.resources.title', 'Output')}
            aria-pressed={resourcesShown}
            onClick={() =>
              visibility.panel.change(
                resourcesShown && visibility.panel.preferences.expanded
                  ? { shown: false }
                  : { shown: true, expanded: true, view: 'resources' }
              )
            }
            onMouseDown={(event) => event.preventDefault()}
            className="pointer-coarse:size-11"
          >
            <Files className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          {t('components.native-chat.resources.title', 'Output')}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
