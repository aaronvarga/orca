import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { RepositorySymbolPicker } from './RepositorySymbolPicker'
import sample from './project-symbols.fixture.json'

export const catalog = defineFixture({
  width: 860,
  setup: () => {
    window.api.shell.getProjectSymbolCatalog = async () => sample.catalog
    const images: Record<string, string> = sample.images
    window.api.shell.renderProjectSymbols = async (names) =>
      Object.fromEntries(names.map((name) => [name, images[name] ?? '']))
  },
  render: () => (
    <div className="h-[720px]">
      <RepositorySymbolPicker selectedName="folder.fill" onSetIcon={() => {}} onClose={() => {}} />
    </div>
  )
})
