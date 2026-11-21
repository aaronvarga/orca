export type NativeChatMilestonePanelPreferences = {
  shown: boolean
  expanded: boolean
  view: 'milestones' | 'agents' | 'resources' | 'questions'
  dock: 'bottom' | 'right'
}

export function nativeChatMilestonePanelPreferences(
  value: Partial<NativeChatMilestonePanelPreferences> | null | undefined
): NativeChatMilestonePanelPreferences {
  return {
    shown: value?.shown !== false,
    expanded: value?.expanded === true,
    view:
      value?.view === 'questions'
        ? 'questions'
        : value?.view === 'resources'
          ? 'resources'
          : value?.view === 'agents'
            ? 'agents'
            : 'milestones',
    dock: value?.dock === 'right' ? 'right' : 'bottom'
  }
}
