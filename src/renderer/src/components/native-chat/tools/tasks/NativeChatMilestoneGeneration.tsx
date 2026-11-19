import { RefreshCw } from 'lucide-react'
import { createContext, useContext, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { NativeChatStructuredComposerTransport } from '../../composer/submit/native-chat-structured-composer-transport'

export const NativeChatMilestoneGenerationContext = createContext<Pick<
  NativeChatStructuredComposerTransport,
  'regenerateMilestones' | 'sessionPending' | 'sessionPendingNotice'
> | null>(null)

export function NativeChatMilestoneGeneration({
  regenerate = false,
  compact = false
}: {
  regenerate?: boolean
  compact?: boolean
  working?: boolean
}) {
  const transport = useContext(NativeChatMilestoneGenerationContext)
  const t = useTranslate()
  const [phase, setPhase] = useState<'ready' | 'generating' | 'failed' | 'superseded'>('ready')
  const sending = useRef(false)
  const regenerateMilestones = transport?.regenerateMilestones
  if (!transport || !regenerateMilestones) {
    return null
  }
  const generate = async () => {
    if (sending.current || transport.sessionPending) {
      return
    }
    sending.current = true
    setPhase('generating')
    try {
      const result = await regenerateMilestones()
      setPhase(result.applied ? 'ready' : 'superseded')
    } catch {
      setPhase('failed')
    }
    sending.current = false
  }
  const label =
    phase === 'generating'
      ? t('components.native-chat.milestones.generating', 'Generating milestones…')
      : regenerate
        ? t('components.native-chat.milestones.regenerate', 'Refresh milestones')
        : t('components.native-chat.milestones.generate', 'Generate milestones')
  return (
    <div className="space-y-1 text-center">
      <Button
        type="button"
        variant={regenerate ? 'ghost' : 'secondary'}
        size={compact ? 'icon-xs' : 'sm'}
        aria-label={label}
        title={
          phase === 'failed'
            ? t(
                'components.native-chat.milestones.generationError',
                'Could not generate milestones. Try again or update the session’s host.'
              )
            : label
        }
        disabled={transport.sessionPending || phase === 'generating'}
        onClick={() => void generate()}
      >
        {compact ? (
          <RefreshCw
            aria-hidden
            className={
              phase === 'generating'
                ? 'size-3.5 animate-spin motion-reduce:animate-none'
                : 'size-3.5'
            }
          />
        ) : (
          label
        )}
      </Button>
      {transport.sessionPending || phase === 'failed' || phase === 'superseded' ? (
        <p
          role="status"
          className={
            compact
              ? 'sr-only'
              : phase === 'failed'
                ? 'text-xs text-destructive'
                : 'text-xs text-muted-foreground'
          }
        >
          {transport.sessionPending
            ? transport.sessionPendingNotice
            : phase === 'failed'
              ? t(
                  'components.native-chat.milestones.generationError',
                  'Could not generate milestones. Try again or update the session’s host.'
                )
              : t(
                  'components.native-chat.milestones.superseded',
                  'The plan changed during generation. The newer milestones were kept.'
                )}
        </p>
      ) : null}
    </div>
  )
}
