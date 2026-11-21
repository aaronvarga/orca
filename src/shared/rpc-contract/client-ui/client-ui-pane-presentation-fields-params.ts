import { z } from 'zod'
import { CommandCenterPresentationSchema } from '../../ui-chrome/command-center-presentation'
import { TerminalOrphanGroupLayout } from '../terminal/terminal-orphan-params'

export const ClientUiPanePresentationFields = {
  projectRailSeparators: z.array(z.string().max(1024)).max(10000).optional(),
  nativeChatTabSplits: z
    .record(
      z.string(),
      z.object({
        executionHostId: z.string().min(1),
        layout: TerminalOrphanGroupLayout
      })
    )
    .optional(),
  commandCenterPresentation: CommandCenterPresentationSchema.optional(),
  markdownTocPanelWidth: z.number().finite().optional(),
  combinedDiffFileTreeWidth: z.number().finite().optional()
}
