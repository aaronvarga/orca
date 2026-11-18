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

let pngIcon = ''
let icnsIcon = ''
function iconImage(padding: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 120
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Icon preview needs a canvas')
  }
  context.fillStyle = '#8b5cf6'
  context.beginPath()
  context.roundRect(padding, padding, 120 - padding * 2, 120 - padding * 2, 20)
  context.fill()
  return canvas.toDataURL('image/png')
}

export const appIconSizing = defineFixture({
  width: 240,
  setup: () => {
    pngIcon = iconImage(0)
    icnsIcon = iconImage(10)
  },
  render: () => (
    <div className="flex items-center gap-6 bg-worktree-sidebar p-4 text-worktree-sidebar-foreground">
      <div className="flex flex-col items-center gap-2 text-xs">
        <RepoIconGlyph
          repoIcon={{ type: 'image', source: 'upload', src: pngIcon, label: 'Icon.png' }}
          className="size-6"
          iconClassName="size-6"
        />
        PNG
      </div>
      <div className="flex flex-col items-center gap-2 text-xs">
        <RepoIconGlyph
          repoIcon={{ type: 'image', source: 'upload', src: icnsIcon, label: 'Icon.icns' }}
          className="size-6"
          iconClassName="size-6"
        />
        ICNS
      </div>
      <div className="flex flex-col items-center gap-2 text-xs">
        <RepoIconGlyph
          repoIcon={{ type: 'lucide', name: 'Code2' }}
          color="#8b5cf6"
          className="size-6"
          iconClassName="size-6"
        />
        Default
      </div>
    </div>
  )
})
