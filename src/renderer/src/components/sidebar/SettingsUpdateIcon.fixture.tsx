import { defineFixture } from '../../component-fixtures/component-fixture'
import { Button } from '@/components/ui/button'
import { SettingsUpdateIcon } from './SettingsUpdateIcon'

export const available = defineFixture({
  width: 220,
  render: () => (
    <div className="flex items-center gap-8 bg-sidebar p-6">
      <Button variant="ghost" size="icon-sm" aria-label="Settings — update available">
        <SettingsUpdateIcon available />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="Settings — update available">
        <SettingsUpdateIcon available />
      </Button>
    </div>
  )
})
