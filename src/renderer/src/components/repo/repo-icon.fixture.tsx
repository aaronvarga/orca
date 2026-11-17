import { defineFixture } from '../../component-fixtures/component-fixture'
import { RepoIconGlyph } from './repo-icon'
import sample from '../settings/repository/identity/project-symbols.fixture.json'
import logoUrl from '../../../../../resources/build/icon.png?url'

export const coloredSquares = defineFixture({
  width: 320,
  render: () => (
    <div className="flex items-center gap-4 p-4">
      <RepoIconGlyph
        repoIcon={{ type: 'lucide', name: 'Code2' }}
        color="#eab308"
        className="size-8"
        iconClassName="size-6"
      />
      <RepoIconGlyph
        repoIcon={{
          type: 'image',
          source: 'symbol',
          src: sample.images['folder.fill'],
          label: 'Folder'
        }}
        color="#8b5cf6"
        className="size-8"
        iconClassName="size-8"
      />
      <RepoIconGlyph repoIcon={null} color="#14b8a6" className="size-8" iconClassName="size-6" />
      <RepoIconGlyph
        repoIcon={{ type: 'image', source: 'upload', src: logoUrl }}
        color="#ef4444"
        className="size-8"
        iconClassName="size-8"
      />
    </div>
  )
})
