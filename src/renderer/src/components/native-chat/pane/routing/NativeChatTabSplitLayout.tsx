import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/class-names'
import { useAppStore } from '@/store'
import { ResizeHandle } from '@/components/pane-resize/PaneSplitResizeHandle'
import { registerTabGroupBody } from '@/components/tab-group/retained-pane/tab-group-body-geometry'
import { tabGroupBodyAnchorName } from '@/components/tab-group/retained-pane/tab-group-body-anchor'
import { updateSplitRatio } from '../../../../../../shared/workspace-layout/tab-groups/tab-group-layout-tree'
import {
  nativeChatPaneAnchorId,
  nativeChatSplitTabIds,
  resolveNativeChatTabSplit
} from '../../../../../../shared/native-chat/layout/native-chat-tab-splits'
import type { TabGroupLayoutNode } from '../../../../../../shared/workspace-layout/tab-groups/tab-types'

function ChatPaneAnchor({ tabId }: { tabId: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = nativeChatPaneAnchorId(tabId)
  useLayoutEffect(() => (ref.current ? registerTabGroupBody(id, ref.current) : undefined), [id])
  return (
    <div
      ref={ref}
      data-chat-split-tab-id={tabId}
      className="relative flex-1 min-h-0 min-w-0"
      style={{ anchorName: tabGroupBodyAnchorName(id) }}
    />
  )
}

export function NativeChatTabSplitLayout({
  layout,
  splitKey,
  worktreeId,
  path = ''
}: {
  layout: TabGroupLayoutNode
  splitKey: string
  worktreeId: string
  path?: string
}) {
  if (layout.type === 'leaf') {
    return <ChatPaneAnchor tabId={layout.groupId} />
  }
  const ratio = layout.ratio ?? 0.5
  return (
    <div
      className={cn('flex flex-1 min-w-0 min-h-0', !path && 'absolute inset-0')}
      style={{ flexDirection: layout.direction === 'horizontal' ? 'row' : 'column' }}
    >
      <div className="flex min-w-0 min-h-0" style={{ flex: `${ratio} 1 0%` }}>
        <NativeChatTabSplitLayout
          layout={layout.first}
          splitKey={splitKey}
          worktreeId={worktreeId}
          path={path ? `${path}.first` : 'first'}
        />
      </div>
      <ResizeHandle
        direction={layout.direction}
        wide
        onResizeStart={() => {}}
        onRatioChange={(next) => {
          const state = useAppStore.getState()
          const root = resolveNativeChatTabSplit(
            state.nativeChatTabSplits,
            state.unifiedTabsByWorktree[worktreeId] ?? [],
            nativeChatSplitTabIds(layout)[0]
          )?.layout
          if (root) {
            state.setNativeChatTabSplits({
              ...state.nativeChatTabSplits,
              [splitKey]: {
                ...state.nativeChatTabSplits![splitKey],
                layout: updateSplitRatio(root, path ? path.split('.') : [], next)
              }
            })
          }
        }}
      />
      <div className="flex min-w-0 min-h-0" style={{ flex: `${1 - ratio} 1 0%` }}>
        <NativeChatTabSplitLayout
          layout={layout.second}
          splitKey={splitKey}
          worktreeId={worktreeId}
          path={path ? `${path}.second` : 'second'}
        />
      </div>
    </div>
  )
}
