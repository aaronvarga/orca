import { z } from 'zod'
import type {
  AzureDevOpsProject,
  AzureDevOpsWorkItem,
  AzureDevOpsWorkItemQuery
} from '../../shared/azure-devops/boards-types'
const segment = encodeURIComponent
export const workItemSchema = z.object({
  id: z.number().int().positive(),
  fields: z.record(z.string(), z.unknown()),
  relations: z
    .array(
      z.object({
        rel: z.string(),
        url: z.string(),
        attributes: z.record(z.string(), z.unknown()).optional()
      })
    )
    .optional()
})
export const fields = [
  'System.Id',
  'System.Title',
  'System.TeamProject',
  'System.WorkItemType',
  'System.State',
  'System.AssignedTo',
  'System.ChangedDate',
  'System.Tags',
  'System.AreaPath',
  'System.IterationPath'
]
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`
export function azureDevOpsWiql(args: AzureDevOpsWorkItemQuery, projectName: string): string {
  const predicates = [`[System.TeamProject] = ${literal(projectName)}`]
  if (args.view !== 'all') {
    predicates.push('[System.AssignedTo] = @Me')
  }
  if (args.search?.trim()) {
    const search = args.search.trim()
    predicates.push(
      /^\d+$/.test(search)
        ? `[System.Id] = ${Number(search)}`
        : `[System.Title] CONTAINS ${literal(search)}`
    )
  }
  if (args.state) {
    predicates.push(`[System.State] = ${literal(args.state)}`)
  }
  if (args.type) {
    predicates.push(`[System.WorkItemType] = ${literal(args.type)}`)
  }
  return `SELECT [System.Id] FROM WorkItems WHERE ${predicates.join(' AND ')} ORDER BY [System.ChangedDate] DESC, [System.Id] DESC`
}
export function mapItem(
  raw: z.infer<typeof workItemSchema>,
  project: AzureDevOpsProject,
  baseUrl: string
): AzureDevOpsWorkItem {
  const text = (key: string): string => {
    const value = raw.fields[key]
    return typeof value === 'string' ? value : ''
  }
  if (text('System.TeamProject').toLowerCase() !== project.name.toLowerCase()) {
    throw new Error('Cross-project queries are unsupported. Open this query in Azure DevOps.')
  }
  const assignee = raw.fields['System.AssignedTo']
  return {
    id: raw.id,
    title: z.string().min(1).parse(raw.fields['System.Title']),
    project,
    type: text('System.WorkItemType'),
    state: text('System.State'),
    assignee:
      typeof assignee === 'string'
        ? assignee
        : (z.object({ displayName: z.string() }).optional().parse(assignee)?.displayName ?? ''),
    updatedAt: text('System.ChangedDate'),
    url: `${baseUrl}/${segment(project.id)}/_workitems/edit/${raw.id}`,
    tags: text('System.Tags'),
    area: text('System.AreaPath'),
    iteration: text('System.IterationPath'),
    description: text('System.Description'),
    acceptanceCriteria: text('Microsoft.VSTS.Common.AcceptanceCriteria'),
    related: (raw.relations ?? []).flatMap((relation) => {
      if (!relation.rel.startsWith('System.LinkTypes.')) {
        return []
      }
      const match = relation.url.match(/\/_apis\/wit\/workitems\/(\d+)$/i)
      return match
        ? [
            {
              id: Number(match[1]),
              url: `${baseUrl}/_workitems/edit/${match[1]}`,
              label: String(relation.attributes?.name ?? relation.rel)
            }
          ]
        : []
    })
  }
}
