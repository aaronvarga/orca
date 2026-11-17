import type { TaskPageComposerActionsModel } from '../use-task-page-composer-actions'
export type AzureTaskPageModel = Pick<
  TaskPageComposerActionsModel,
  'accountBackedTaskSourceHostId' | 'fallbackTaskSourceProjectId' | 'openModal' | 'pageData'
> &
  Partial<Pick<TaskPageComposerActionsModel, 'hostRegistryById' | 'hostLabelById'>>
