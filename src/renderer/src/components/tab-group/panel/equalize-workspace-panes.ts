import { useAppStore } from '@/store'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../../../../shared/workspace-layout/layout-owner-switch'
import type { TabGroupLayoutNode } from '../../../../../shared/workspace-layout/tab-groups/tab-types'
import { setGroupRatioThroughLayoutOwner } from '@/runtime/workspace-layout/commands/tab-group-layout-owner-commands'

export function equalizeWorkspacePanes(worktreeId: string): void {
  const state = useAppStore.getState()
  const layout = state.layoutByWorktree[worktreeId]
  if (!layout) {
    return
  }
  const weight = (node: TabGroupLayoutNode, direction: 'horizontal' | 'vertical'): number =>
    node.type === 'split' && node.direction === direction
      ? weight(node.first, direction) + weight(node.second, direction)
      : 1
  const visit = (node: TabGroupLayoutNode, path: string) => {
    if (node.type === 'leaf') {
      return
    }
    const first = weight(node.first, node.direction)
    const second = weight(node.second, node.direction)
    const ratio = first / (first + second)
    if (ORCA_LAYOUT_OWNER_IS_MAIN) {
      setGroupRatioThroughLayoutOwner(worktreeId, path, ratio)
    } else {
      state.setTabGroupSplitRatio(worktreeId, path, ratio)
    }
    visit(node.first, path ? `${path}.first` : 'first')
    visit(node.second, path ? `${path}.second` : 'second')
  }
  visit(layout, '')
}
