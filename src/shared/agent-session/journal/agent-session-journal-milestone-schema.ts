import * as z from 'zod'
import { MILESTONE_ETA_PATTERN } from '../../native-chat/input/task-lists/native-chat-milestone-eta'

export const AgentMilestonePlanSchema = z.object({
  basedOn: z.string().nullable(),
  tasks: z
    .array(
      z.object({
        id: z.string().optional(),
        activeForm: z.string().optional(),
        details: z.string().trim().min(1).max(600).optional(),
        parallelGroup: z.string().trim().min(1).max(200).optional(),
        blocker: z
          .object({
            kind: z.enum(['blocked', 'waiting']),
            reason: z.string().trim().min(1).max(200)
          })
          .optional(),
        timing: z
          .object({ elapsedMs: z.number().nonnegative(), estimate: z.string().optional() })
          .optional(),
        eta: z.string().trim().max(32).regex(MILESTONE_ETA_PATTERN).optional(),
        content: z.string().trim().min(1).max(512),
        status: z.enum(['pending', 'in_progress', 'completed'])
      })
    )
    .min(1)
    .max(6)
})

export type AgentMilestonePlan = z.infer<typeof AgentMilestonePlanSchema>
