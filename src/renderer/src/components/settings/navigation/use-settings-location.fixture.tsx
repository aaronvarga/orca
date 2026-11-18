import { useState } from 'react'
import { defineFixture } from '../../../component-fixtures/component-fixture'
import { useSettingsLocation } from './use-settings-location'
import { Button } from '@/components/ui/button'

function SettingsVisit() {
  const location = useSettingsLocation()
  return (
    <div data-section={location.activeSectionId} data-subpage={location.generalSubPage}>
      <div className="flex gap-2 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => location.setActiveSectionId('appearance')}
        >
          Appearance
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            location.setActiveSectionId('general')
            location.setGeneralSubPage('editor')
          }}
        >
          Editor
        </Button>
      </div>
      <div
        ref={location.rememberSettingsScrollNode}
        data-settings-visit-scroll
        className="scrollbar-sleek h-40 overflow-auto border border-border"
      >
        <div className="h-320 p-3 text-sm">
          {location.activeSectionId} / {location.generalSubPage ?? 'overview'}
        </div>
      </div>
    </div>
  )
}

function Visits() {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-background p-4 text-foreground">
      <Button variant="outline" size="sm" data-toggle-settings onClick={() => setOpen(!open)}>
        {open ? 'Leave Settings' : 'Return to Settings'}
      </Button>
      {open ? <SettingsVisit /> : null}
    </div>
  )
}

function resumeFixture(section: 'appearance' | 'general') {
  return defineFixture({
    width: 480,
    render: () => <Visits />,
    interact: async (frame) => {
      const settle = () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      const choice = Array.from(frame.querySelectorAll('button')).find(
        (button) => button.textContent === (section === 'general' ? 'Editor' : 'Appearance')
      )
      choice?.click()
      await settle()
      const scroller = frame.querySelector<HTMLElement>('[data-settings-visit-scroll]')
      if (!scroller) {
        throw new Error('Settings must render its content scroller')
      }
      scroller.scrollTop = 360
      frame.querySelector<HTMLButtonElement>('[data-toggle-settings]')?.click()
      await settle()
      frame.querySelector<HTMLButtonElement>('[data-toggle-settings]')?.click()
      await settle()
      const restored = frame.querySelector<HTMLElement>('[data-settings-visit-scroll]')
      const visit = frame.querySelector('[data-section]')
      if (
        restored?.scrollTop !== 360 ||
        visit?.getAttribute('data-section') !== section ||
        (section === 'general' && visit?.getAttribute('data-subpage') !== 'editor')
      ) {
        throw new Error('Returning to Settings must resume its page, subpage and scroll position')
      }
    }
  })
}

export const page = resumeFixture('appearance')
export const subpage = resumeFixture('general')
