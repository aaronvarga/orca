import { defineFixture } from '../../component-fixtures/component-fixture'
import { FolderPathButton } from './FolderPathButton'

function pathFixture(path: string) {
  return defineFixture({
    width: 320,
    render: () => (
      <footer className="flex items-center border-t border-border bg-background p-2 text-foreground">
        <FolderPathButton path={path} owner="local" showPath />
      </footer>
    )
  })
}

export const longPath = pathFixture('/Users/aaron/Dev/Repos/Emergent/Emergent.Estimator')
export const shortPath = pathFixture('/projects/orca')
export const windows = pathFixture('C:\\Users\\aaron\\Dev\\Repos\\Emergent\\Emergent.Estimator')
export const trailingSeparator = pathFixture('/Users/aaron/Dev/Repos/Emergent/Emergent.Estimator/')
