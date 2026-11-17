export const PROJECT_RAIL_WIDTH = 40

export function renderedSidebarWidth(sidebarOpen: boolean, width: number): number {
  return sidebarOpen ? width : PROJECT_RAIL_WIDTH
}
