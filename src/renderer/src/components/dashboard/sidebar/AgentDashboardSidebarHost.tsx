import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { AgentDashboardDrawer } from '@/components/dashboard/AgentDashboardDrawer'

type AgentDashboardSidebarHostProps = {
  workspaceBoardOpen: boolean
  closeWorkspaceBoard: () => void
  leftSidebarStyle?: React.CSSProperties
  statusBarVisible: boolean
}

export default function AgentDashboardSidebarHost({
  workspaceBoardOpen,
  closeWorkspaceBoard,
  leftSidebarStyle,
  statusBarVisible
}: AgentDashboardSidebarHostProps): React.JSX.Element | null {
  const drawerOpen = useAppStore((s) => s.agentDashboardDrawerOpen)
  const setDrawerOpen = useAppStore((s) => s.setAgentDashboardDrawerOpen)

  useEffect(() => {
    if (drawerOpen) {
      closeWorkspaceBoard()
    }
  }, [closeWorkspaceBoard, drawerOpen])
  useEffect(() => {
    if (workspaceBoardOpen) {
      setDrawerOpen(false)
    }
  }, [setDrawerOpen, workspaceBoardOpen])

  return (
    <AgentDashboardDrawer leftSidebarStyle={leftSidebarStyle} statusBarVisible={statusBarVisible} />
  )
}
