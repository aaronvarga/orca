import { NativeChatSessionQuestions } from '../../resources/NativeChatSessionQuestions'
import type { SessionQuestion } from '../../../../../../shared/native-chat/session-questions'
import { NativeChatSessionResources } from '../../resources/NativeChatSessionResources'
import type { SessionResources } from '../../../../../../shared/native-chat/session-resources'
import { useContext } from 'react'
import { flattenAgentChildRowModels } from '../../../../../../shared/agent-status/presentation/agent-child-row-model'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  NativeChatAgentVisualizer,
  NativeChatAgentVisualizerContext
} from '../../subagents/NativeChatAgentVisualizer'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/class-names'
import { Badge } from '@/components/ui/badge'
import { milestoneOverallEta } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestone-eta'
import { NativeChatMilestoneSummary } from './NativeChatMilestoneSummary'
import { useNativeChatMilestoneVisibility } from './NativeChatMilestoneVisibility'
import { NativeChatMilestoneGeneration } from './NativeChatMilestoneGeneration'
import {
  ChevronDown,
  Files,
  ListChecks,
  MessageSquareText,
  PanelBottom,
  PanelRight
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTranslate } from '@/i18n/use-translate'
import { useNativeChatMilestonePreferences } from './use-native-chat-milestone-preferences'
import type { NativeChatMilestones } from '../../../../../../shared/native-chat/input/task-lists/native-chat-milestones'
import { Checklist } from './NativeChatTaskList'

export function NativeChatMilestonePanel({
  list,
  sessionId,
  working,
  waitingForInput,
  resources,
  questions,
  historyIncomplete,
  loadingEarlier,
  onLoadEarlier
}: {
  list: NativeChatMilestones | null
  sessionId: string
  working: boolean
  waitingForInput?: boolean
  resources: SessionResources
  questions: SessionQuestion[]
  historyIncomplete?: boolean
  loadingEarlier?: boolean
  onLoadEarlier?: () => void
}) {
  const t = useTranslate()
  const agents = useContext(NativeChatAgentVisualizerContext)
  const agentCount = flattenAgentChildRowModels(agents?.rows ?? []).filter(
    (row) => row.kind === 'agent'
  ).length
  const visibility = useNativeChatMilestoneVisibility()
  const fallback = useNativeChatMilestonePreferences(sessionId)
  const panel = visibility?.panel ?? fallback
  const filesView = panel.preferences.view === 'resources'
  const questionsView = panel.preferences.view === 'questions'
  const progressView = !filesView && !questionsView
  const resourceCount =
    resources.links.length +
    resources.outputs.length +
    resources.uploads.length +
    resources.sources.length +
    resources.changedFiles.length
  const right = panel.preferences.dock === 'right'
  const dockLabel = right
    ? t('components.native-chat.milestones.dockBottom', 'Move milestones to the bottom')
    : t('components.native-chat.milestones.dockRight', 'Move milestones to the right')
  const disclosure = {
    open: panel.preferences.expanded,
    setOpen: (expanded: boolean) => panel.change({ expanded })
  }
  const current =
    list?.tasks.find((task) => task.status === 'in_progress') ??
    list?.tasks.find((task) => task.status !== 'completed')
  const overall = milestoneOverallEta(list?.tasks ?? [])
  const completed = list?.tasks.filter((task) => task.status === 'completed').length ?? 0
  return (
    <Collapsible asChild open={disclosure.open} onOpenChange={disclosure.setOpen}>
      <div
        data-native-chat-milestone-panel=""
        className={cn(
          '@container/progress flex max-h-full min-h-0 flex-col overflow-hidden text-foreground',
          right &&
            '@min-[1000px]/milestones:rounded-xl @min-[1000px]/milestones:border @min-[1000px]/milestones:border-border @min-[1000px]/milestones:bg-card @min-[1000px]/milestones:shadow-xs'
        )}
      >
        <div className="flex shrink-0 items-center">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-8 min-w-0 flex-1 items-center gap-2 px-3 py-1 text-left text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {questionsView ? (
                <MessageSquareText aria-hidden className="size-3.5 shrink-0" />
              ) : filesView ? (
                <Files aria-hidden className="size-3.5 shrink-0" />
              ) : (
                <ListChecks aria-hidden className="size-3.5 shrink-0" />
              )}
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 font-semibold text-foreground">
                  {questionsView
                    ? t('components.native-chat.questions.tab', 'Q&A')
                    : filesView
                      ? t('components.native-chat.resources.title', 'Output')
                      : t('components.native-chat.milestones.title', 'Milestones')}
                </span>
                {progressView && !disclosure.open && current ? (
                  <span className="min-w-0 flex-1 truncate">{current.content}</span>
                ) : null}
                {progressView && overall.eta ? (
                  <Badge
                    variant="agentEta"
                    title={t('components.native-chat.milestones.remaining', 'Agent time remaining')}
                  >
                    {overall.eta}
                    {overall.incomplete ? '+' : ''}
                  </Badge>
                ) : null}
              </span>
              {progressView && list ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {completed}/{list.tasks.length}
                </span>
              ) : null}
              <ChevronDown
                aria-hidden
                className={`size-3.5 shrink-0 ${disclosure.open ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          {progressView && list ? <NativeChatMilestoneGeneration regenerate compact /> : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="mr-1"
                aria-label={dockLabel}
                onClick={() => panel.change({ dock: right ? 'bottom' : 'right' })}
                onMouseDown={(event) => event.preventDefault()}
              >
                {right ? <PanelBottom className="size-3.5" /> : <PanelRight className="size-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              {dockLabel}
            </TooltipContent>
          </Tooltip>
        </div>
        <CollapsibleContent asChild>
          <div
            className={cn(
              'max-h-64 min-h-0 space-y-2 overflow-y-auto border-t border-border p-1 scrollbar-sleek',
              right && '@min-[1000px]/milestones:max-h-none @min-[1000px]/milestones:flex-1'
            )}
          >
            <Tabs
              value={panel.preferences.view}
              onValueChange={(view) =>
                panel.change({
                  view:
                    view === 'questions'
                      ? 'questions'
                      : view === 'resources'
                        ? 'resources'
                        : view === 'agents'
                          ? 'agents'
                          : 'milestones'
                })
              }
            >
              <TabsList
                size="sm"
                variant="line"
                aria-label={t('components.native-chat.milestones.views', 'Progress views')}
                className="w-full shrink-0"
              >
                <TabsTrigger value="milestones">
                  {t('components.native-chat.milestones.title', 'Milestones')}
                  <Badge variant="count" className="hidden @min-[360px]/progress:inline-flex">
                    {list?.tasks.length ?? 0}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="agents">
                  {t('components.native-chat.agents.title', 'Agents')}
                  <Badge variant="count" className="hidden @min-[360px]/progress:inline-flex">
                    {agentCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="resources">
                  {t('components.native-chat.resources.tab', 'Output')}
                  <Badge variant="count" className="hidden @min-[360px]/progress:inline-flex">
                    {resourceCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="questions">
                  {t('components.native-chat.questions.tab', 'Q&A')}
                  <Badge variant="count" className="hidden @min-[360px]/progress:inline-flex">
                    {questions.length}
                  </Badge>
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
              <TabsContent value="questions">
                <NativeChatSessionQuestions
                  questions={questions}
                  loadingEarlier={loadingEarlier}
                  onLoadEarlier={onLoadEarlier}
                  historyIncomplete={historyIncomplete}
                />
              </TabsContent>
              <TabsContent value="resources">
                <NativeChatSessionResources
                  resources={resources}
                  historyIncomplete={historyIncomplete}
                />
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
