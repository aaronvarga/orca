import { useState } from 'react'
import logoUrl from '../../../../../../../resources/build/icon.png?url'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import type { Repo } from '../../../../../../shared/repository/repo-types'
import { RepositoryIconPicker } from './RepositoryIconPicker'

function LogoAndColor() {
  const [repo, setRepo] = useState<Repo>({
    id: 'project',
    displayName: 'Project with logo',
    path: '/project',
    addedAt: 1,
    badgeColor: '#14b8a6',
    repoIcon: { type: 'image', source: 'upload', src: logoUrl, label: 'Uploaded logo' }
  })
  return (
    <RepositoryIconPicker
      repo={repo}
      updateRepo={(_, updates) => setRepo((current) => ({ ...current, ...updates }))}
    />
  )
}

export const logoAndColor = defineFixture({ width: 440, render: () => <LogoAndColor /> })
