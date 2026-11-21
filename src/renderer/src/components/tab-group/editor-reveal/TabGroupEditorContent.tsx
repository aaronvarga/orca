import { Suspense } from 'react'
import { lazyWithRetry as lazy } from '@/app-shell/startup/lazy-with-retry'
import { useTranslate } from '@/i18n/use-translate'
import type { Tab } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import { EditorRevealFlash } from './EditorRevealFlash'

const EditorPanel = lazy(() => import('../../editor/EditorPanel'))

export function TabGroupEditorContent({
  tab,
  isVisible,
  isFocused,
  markdownAnnotationsEnabled
}: {
  tab: Tab
  isVisible: boolean
  isFocused: boolean
  markdownAnnotationsEnabled: boolean
}) {
  const t = useTranslate()
  return (
    <>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {t('auto.components.tab.group.TabGroupPanel.814fb04c43', 'Loading editor...')}
          </div>
        }
      >
        <EditorPanel
          activeFileId={tab.entityId}
          activeViewStateId={tab.id}
          isVisible={isVisible}
          isCmdSaveOwner={isFocused}
          markdownAnnotationsEnabled={markdownAnnotationsEnabled}
        />
      </Suspense>
      <EditorRevealFlash viewStateId={tab.id} />
    </>
  )
}
