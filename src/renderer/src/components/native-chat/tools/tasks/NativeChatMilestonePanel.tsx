import { useContext } from 'react'
import { flattenAgentChildRowModels } from '../../../../../../shared/agent-status/presentation/agent-child-row-model'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  NativeChatAgentVisualizer,
  NativeChatAgentVisualizerContext
} from '../../subagents/NativeChatAgentVisualizer'
import { Badge } from '@/components/ui/badge'
import { milestoneOverallEta } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestone-eta'
import { NativeChatMilestoneSummary } from './NativeChatMilestoneSummary'
import { cn } from '@/lib/class-names'
import { useNativeChatMilestoneVisibility } from './NativeChatMilestoneVisibility'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NativeChatMilestoneGeneration } from './NativeChatMilestoneGeneration'
import {
  ChevronRight,
  ListChecks,
  PanelBottom,
  PanelRight,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import {
  MAX_NATIVE_CHAT_DISCLOSURES,
  useNativeChatDisclosure
} from '../../messages/disclosure/native-chat-disclosure-store'
import type { NativeChatMilestones } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestones'
import { Checklist } from './NativeChatTaskList'

const rememberedOpen = new Map<string, boolean>()

export function NativeChatMilestonePanel({
  list,
  sessionId,
  working,
  waitingForInput,
  view,
  onViewChange
}: {
  list: NativeChatMilestones | null
  sessionId: string
  working: boolean
  waitingForInput?: boolean
  view?: string
  onViewChange?: (value: string) => void
}) {
  const t = useTranslate()
  const agents = useContext(NativeChatAgentVisualizerContext)
  const agentCount = flattenAgentChildRowModels(agents?.rows ?? []).filter(
    (row) => row.kind === 'agent'
  ).length
  const visibility = useNativeChatMilestoneVisibility()
  const fullHeight = visibility?.fullHeight === true && !visibility.bottom
  const disclosure = useNativeChatDisclosure(
    `milestones:${sessionId}`,
    rememberedOpen.get(sessionId) ?? true
  )
  const setOpen = (open: boolean) => {
    rememberedOpen.delete(sessionId)
    rememberedOpen.set(sessionId, open)
    const oldest = rememberedOpen.keys().next().value
    if (rememberedOpen.size > MAX_NATIVE_CHAT_DISCLOSURES && oldest !== undefined) {
      rememberedOpen.delete(oldest)
    }
    disclosure.setOpen(open)
  }
  const overall = milestoneOverallEta(list?.tasks ?? [])
  const completed = list?.tasks.filter((task) => task.status === 'completed').length ?? 0
  return (
    <Collapsible asChild open={disclosure.open} onOpenChange={setOpen}>
      <div
        className={cn(
          'flex max-h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xs',
          fullHeight && disclosure.open && '@min-[1000px]/milestones:h-full'
        )}
      >
        <div className="flex shrink-0 items-center">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ListChecks aria-hidden className="size-4 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <span className="font-medium">
                  {t('components.native-chat.milestones.title', 'Milestones')}
                </span>
                {overall.eta ? (
                  <Badge
                    variant="agentEta"
                    title={t('components.native-chat.milestones.remaining', 'Agent time remaining')}
                  >
                    {overall.eta}
                    {overall.incomplete ? '+' : ''}
                  </Badge>
                ) : null}
              </span>
              {list ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {completed}/{list.tasks.length}
                </span>
              ) : null}
              <ChevronRight
                aria-hidden
                className={`size-3.5 shrink-0 ${disclosure.open ? 'rotate-90' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          {list ? <NativeChatMilestoneGeneration regenerate compact /> : null}
          {visibility ? (
            <div className="hidden shrink-0 items-center gap-0.5 pr-1 @min-[1000px]/milestones:flex">
              <MilestonePanelButton
                label={
                  visibility.bottom
                    ? t(
                        'components.native-chat.milestones.dockRight',
                        'Move milestones to the right'
                      )
                    : t(
                        'components.native-chat.milestones.dockBottom',
                        'Move milestones to the bottom'
                      )
                }
                onClick={visibility.toggleDock}
              >
                {visibility.bottom ? (
                  <PanelRight className="size-3.5" />
                ) : (
                  <PanelBottom className="size-3.5" />
                )}
              </MilestonePanelButton>
              {!visibility.bottom ? (
                <MilestonePanelButton
                  label={
                    fullHeight
                      ? t(
                          'components.native-chat.milestones.restoreHeight',
                          'Restore milestone height'
                        )
                      : t(
                          'components.native-chat.milestones.maximizeHeight',
                          'Maximize milestone height'
                        )
                  }
                  pressed={fullHeight}
                  onClick={() => {
                    if (!fullHeight) {
                      setOpen(true)
                    }
                    visibility.toggleFullHeight()
                  }}
                >
                  {fullHeight ? (
                    <Minimize2 className="size-3.5" />
                  ) : (
                    <Maximize2 className="size-3.5" />
                  )}
                </MilestonePanelButton>
              ) : null}
            </div>
          ) : null}
        </div>
        <CollapsibleContent asChild>
          <div
            className={cn(
              'max-h-64 min-h-0 space-y-2 overflow-y-auto border-t border-border p-1 scrollbar-sleek',
              fullHeight
                ? '@min-[1000px]/milestones:max-h-none @min-[1000px]/milestones:flex-1'
                : '@min-[1000px]/milestones:max-h-96'
            )}
          >
            <Tabs defaultValue="milestones" value={view} onValueChange={onViewChange}>
              <TabsList
                size="sm"
                variant="line"
                aria-label={t('components.native-chat.milestones.views', 'Progress views')}
                className="w-full shrink-0"
              >
                <TabsTrigger value="milestones">
                  {t('components.native-chat.milestones.title', 'Milestones')}
                  <Badge variant="count">{list?.tasks.length ?? 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="agents">
                  {t('components.native-chat.agents.title', 'Agents')}
                  <Badge variant="count">{agentCount}</Badge>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="milestones">
                <div className="space-y-2">
                  {list ? (
                    <>
                      <NativeChatMilestoneSummary list={list} waitingForInput={waitingForInput} />
                      <Checklist list={list} compact />
                    </>
                  ) : (
                    <div className="flex justify-center py-2">
                      <NativeChatMilestoneGeneration working={working} />
                    </div>
                  )}
                  {list?.saveError ? (
                    <p role="status" className="text-xs text-destructive">
                      {t(
                        'components.native-chat.milestones.saveError',
                        'Milestones could not be saved. Orca will retry on the next update.'
                      )}
                    </p>
                  ) : null}
                </div>
              </TabsContent>
              <TabsContent value="agents">
                <NativeChatAgentVisualizer />
              </TabsContent>
            </Tabs>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

function MilestonePanelButton({
  label,
  pressed,
  onClick,
  children
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          onMouseDown={(event) => event.preventDefault()}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
