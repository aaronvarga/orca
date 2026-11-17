import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { Github, Image, Link2 } from 'lucide-react'
import type { RepoIcon } from '../../../../../../shared/repository/appearance/repo-icon'
import { faviconUrlFromWebsite } from '../../../../../../shared/repository/appearance/repo-icon'
import { Button } from '../../../ui/button'
import { Input } from '../../../ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs'
import { RepositorySymbolPicker } from './RepositorySymbolPicker'
import { useMountedRef } from '@/hooks/useMountedRef'
import { useTranslate } from '@/i18n/use-translate'
import { lazyWithRetry } from '@/app-shell/startup/lazy-with-retry'
import { repoIconPickFailureText } from './repo-icon-pick-failure-text'

const RepositoryIconEmojiPicker = lazyWithRetry(
  () =>
    import('./RepositoryIconEmojiPicker').then((module) => ({
      default: module.RepositoryIconEmojiPicker
    })),
  { reloadKey: 'repo-icon-emoji-picker' }
)

type RepositoryIconTabsProps = {
  initialTab: 'avatar' | 'icon' | 'emoji'
  selectedLucideName: string | null
  selectedEmoji: string
  selectedSymbolName?: string | null
  loadingGitHub: boolean
  onSetIcon: (repoIcon: RepoIcon | null) => void
  onUseGitHubAvatar?: () => void
}

export function RepositoryIconTabs({
  initialTab,
  selectedLucideName,
  selectedEmoji,
  selectedSymbolName,
  loadingGitHub,
  onSetIcon,
  onUseGitHubAvatar
}: RepositoryIconTabsProps): React.JSX.Element {
  const t = useTranslate()
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false)
  const [website, setWebsite] = useState('')
  const mountedRef = useMountedRef()

  const handleUploadImage = async () => {
    try {
      const result = await window.api.shell.pickRepoIconImage()
      if (!result || !mountedRef.current) {
        return
      }
      if ('error' in result) {
        toast.error(repoIconPickFailureText(result))
        return
      }
      onSetIcon({
        type: 'image',
        src: result.dataUrl,
        source: 'upload',
        label: result.fileName
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t(
              'auto.components.settings.RepositoryIconPicker.868c5c9b56',
              'Failed to import repo icon'
            )
      )
    }
  }

  const handleUseWebsiteFavicon = () => {
    const src = faviconUrlFromWebsite(website)
    if (!src) {
      toast.error(
        t('auto.components.settings.RepositoryIconPicker.acf31559a0', 'Enter a valid website URL.')
      )
      return
    }
    onSetIcon({
      type: 'image',
      src,
      source: 'favicon',
      label: t('auto.components.settings.RepositoryIconPicker.4d039317f4', 'Website favicon')
    })
  }

  return (
    <Tabs defaultValue={initialTab} className="gap-3">
      <TabsList variant="line" className="h-8">
        <TabsTrigger value="avatar" className="h-7 text-xs">
          {onUseGitHubAvatar
            ? t('auto.components.settings.RepositoryIconPicker.2d8bd302fa', 'Avatar')
            : t('sidebar.folderGroupImageTab', 'Image')}
        </TabsTrigger>
        <TabsTrigger value="icon" className="h-7 text-xs">
          {t('auto.components.settings.RepositoryIconPicker.b2d7fd2116', 'Icon')}
        </TabsTrigger>
        <TabsTrigger value="emoji" className="h-7 text-xs">
          {t('auto.components.settings.RepositoryIconPicker.c490787d24', 'Emoji')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="avatar" className="space-y-3">
        {onUseGitHubAvatar ? (
          <>
            <Button
              type="button"
              variant="default"
              className="w-full gap-2"
              disabled={loadingGitHub}
              onClick={() => void onUseGitHubAvatar()}
            >
              <Github className="size-3.5" />
              {t('auto.components.settings.RepositoryIconPicker.cc76342291', 'Use GitHub avatar')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t(
                'auto.components.settings.RepositoryIconPicker.7da623abcc',
                "Used by default — GitHub always provides one, even when the owner hasn't set a custom image."
              )}
            </p>
          </>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void handleUploadImage()}
        >
          <Image className="size-3.5" />
          {t('settings.repository.uploadIcon', 'Upload PNG or ICNS')}
        </Button>
        <div className="flex gap-2">
          <Input
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            placeholder={t(
              'auto.components.settings.RepositoryIconPicker.03ca1a4e9b',
              'example.com'
            )}
            className="h-9 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={handleUseWebsiteFavicon}
          >
            <Link2 className="size-3.5" />
            {t('auto.components.settings.RepositoryIconPicker.cc1286e263', 'Favicon')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('settings.repository.iconUploadHint', 'PNG: up to 256KB. ICNS: up to 10MB.')}
        </p>
      </TabsContent>

      <TabsContent value="icon" className="space-y-3">
        <Button variant="outline" size="sm" onClick={() => setSymbolPickerOpen(true)}>
          {t('projectSymbols.choose', 'Choose icon…')}
        </Button>
        {symbolPickerOpen ? (
          <RepositorySymbolPicker
            selectedName={selectedSymbolName ?? selectedLucideName}
            onSetIcon={onSetIcon}
            onClose={() => setSymbolPickerOpen(false)}
          />
        ) : null}
      </TabsContent>

      <TabsContent value="emoji">
        <Suspense fallback={null}>
          <RepositoryIconEmojiPicker selectedEmoji={selectedEmoji} onSetIcon={onSetIcon} />
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}
