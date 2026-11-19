import type { Repo } from '../../../../../shared/repository/repo-types'
import type { Translate } from '@/i18n/use-translate'

export function getProjectFolderSearchEntry(repo: Repo, t: Translate) {
  return {
    title: t('settings.projectFolder.title', 'Project folder'),
    keywords: [
      repo.displayName,
      repo.path,
      t('settings.projectFolder.searchKeywords', 'folder location path repoint relocate')
    ]
  }
}
