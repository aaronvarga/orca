import type { TabGroupLayoutNode } from './tab-types'

export function arrangeTabGroups(
  groups: readonly { id: string; tabOrder: string[] }[],
  tabIds: ReadonlySet<string>,
  columns: number,
  rows: number,
  mintId: () => string
): { groups: { id: string; tabOrder: string[] }[]; layout: TabGroupLayoutNode } | null {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
    return null
  }
  const order = groups.flatMap((group) => group.tabOrder).filter((id) => tabIds.has(id))
  if (!order.length) {
    return null
  }
  const hidden = groups
    .map((group) => ({ ...group, tabOrder: group.tabOrder.filter((id) => !tabIds.has(id)) }))
    .filter((group) => group.tabOrder.length > 0)
  const hiddenIds = new Set(hidden.map((group) => group.id))
  const reusable = groups.filter((group) => !hiddenIds.has(group.id))
  const arranged: { id: string; tabOrder: string[] }[] = Array.from(
    { length: Math.min(order.length, columns * rows) },
    (_, index) => ({
      id: reusable[index]?.id ?? mintId(),
      tabOrder: []
    })
  )
  order.forEach((id, index) => arranged[index % arranged.length].tabOrder.push(id))
  const join = (
    nodes: TabGroupLayoutNode[],
    direction: 'horizontal' | 'vertical'
  ): TabGroupLayoutNode => {
    if (nodes.length === 1) {
      return nodes[0]
    }
    return {
      type: 'split',
      direction,
      ratio: 1 / nodes.length,
      first: nodes[0],
      second: join(nodes.slice(1), direction)
    }
  }
  const rowTrees: TabGroupLayoutNode[] = []
  for (let index = 0; index < arranged.length; index += columns) {
    rowTrees.push(
      join(
        arranged.slice(index, index + columns).map((group) => ({
          type: 'leaf',
          groupId: group.id
        })),
        'horizontal'
      )
    )
  }
  const visible = join(rowTrees, 'vertical')
  const layout = hidden.length
    ? join(
        [
          visible,
          ...hidden.map((group): TabGroupLayoutNode => ({
            type: 'leaf',
            groupId: group.id
          }))
        ],
        'horizontal'
      )
    : visible
  return { groups: [...arranged, ...hidden], layout }
}
