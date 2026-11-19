import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'

const MilestoneVisibility = createContext<{
  shown: boolean
  toggle: () => void
  bottom: boolean
  toggleDock: () => void
  fullHeight: boolean
  toggleFullHeight: () => void
} | null>(null)

export function NativeChatMilestoneVisibilityProvider({
  children,
  enabled = true
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const [shown, setShown] = useState(false)
  const [bottom, setBottom] = useState(false)
  const [fullHeight, setFullHeight] = useState(true)
  const value = useMemo(
    () =>
      enabled
        ? {
            shown,
            toggle: () => setShown((current) => !current),
            bottom,
            toggleDock: () => setBottom((current) => !current),
            fullHeight,
            toggleFullHeight: () => setFullHeight((current) => !current)
          }
        : null,
    [enabled, shown, bottom, fullHeight]
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
  const label = visibility.shown
    ? t('components.native-chat.milestones.hide', 'Hide milestones')
    : t('components.native-chat.milestones.show', 'Show milestones')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={visibility.shown ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={label}
          aria-pressed={visibility.shown}
          onClick={visibility.toggle}
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
  )
}
