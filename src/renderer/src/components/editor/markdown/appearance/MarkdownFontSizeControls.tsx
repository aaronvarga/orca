import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { usePluginDeclaredSettings } from '@/components/plugins/state/use-plugin-declared-settings'
import type { ActivePluginCustomEditor } from '@/store/plugins/file-editors/plugin-custom-editors'
import { resolveMarkdownFontSize } from '../../../../../../shared/editor/markdown/markdown-font-size'

function FontSizeButtons({
  value,
  minimum = 8,
  maximum = 32,
  onChange
}: {
  value: number
  minimum?: number
  maximum?: number
  onChange: (value: number) => Promise<void>
}) {
  const t = useTranslate()
  const [saving, setSaving] = useState(false)
  const change = async (next: number) => {
    setSaving(true)
    try {
      await onChange(next)
    } catch (error) {
      toast.error(t('markdown.fontSize.saveFailed', 'Could not save Markdown text size.'), {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      role="group"
      aria-label={t('markdown.fontSize.label', 'Markdown text size')}
    >
      {(
        [
          [-1, Minus, t('markdown.fontSize.decrease', 'Decrease Markdown text size')],
          [1, Plus, t('markdown.fontSize.increase', 'Increase Markdown text size')]
        ] as const
      ).map(([step, Icon, label]) => (
        <Tooltip key={step}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              disabled={saving || (step < 0 ? value <= minimum : value >= maximum)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void change(Math.min(maximum, Math.max(minimum, value + step)))}
            >
              <Icon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {label}
          </TooltipContent>
        </Tooltip>
      ))}
      <span
        className="min-w-9 text-center text-2xs tabular-nums text-muted-foreground"
        aria-live="polite"
      >
        {t('markdown.fontSize.value', '{{size}} px', { size: value })}
      </span>
    </div>
  )
}

function BuiltInMarkdownFontSizeControls() {
  const value = useAppStore((state) => resolveMarkdownFontSize(state.settings?.markdownFontSize))
  return (
    <FontSizeButtons
      value={value}
      onChange={(markdownFontSize) =>
        useAppStore.getState().updateSettingsOrThrow({ markdownFontSize })
      }
    />
  )
}

function PluginMarkdownFontSizeControls({ pluginKey }: { pluginKey: string }) {
  const { snapshot } = usePluginDeclaredSettings(pluginKey, '')
  const [saved, setSaved] = useState<number | null>(null)
  const setting = snapshot?.settings.find(
    (entry) => entry.key === 'fontSize' && (entry.type === 'number' || entry.type === 'integer')
  )
  const value = saved ?? snapshot?.values.fontSize
  if (!setting || typeof value !== 'number') {
    return null
  }
  return (
    <FontSizeButtons
      value={value}
      minimum={setting.minimum ?? 8}
      maximum={setting.maximum ?? 32}
      onChange={async (next) => {
        const write = window.api.plugins.setSetting
        if (!write) {
          throw new Error('Plugin settings are unavailable.')
        }
        const result = await write({ pluginKey, key: setting.key, value: next })
        if (!result.ok) {
          throw new Error(result.error)
        }
        setSaved(next)
      }}
    />
  )
}

export function MarkdownFontSizeControls({
  customEditor
}: {
  customEditor?: ActivePluginCustomEditor | null
}) {
  return customEditor ? (
    <PluginMarkdownFontSizeControls
      key={customEditor.pluginKey}
      pluginKey={customEditor.pluginKey}
    />
  ) : (
    <BuiltInMarkdownFontSizeControls />
  )
}
