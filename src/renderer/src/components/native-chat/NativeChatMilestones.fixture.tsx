import { defineFixture } from '../../component-fixtures/component-fixture'
import { Layout, list, visibleFixture } from './native-chat-milestone-layout-test-fixture'

export const desktop = visibleFixture({ width: 1100, render: () => <Layout width={1100} /> })
export const narrow = visibleFixture({ width: 720, render: () => <Layout width={720} /> })
export const mobile = visibleFixture({ width: 360, render: () => <Layout width={360} /> })
export const preparing = visibleFixture({
  width: 360,
  render: () => <Layout width={360} plan={null} />
})
export const completed = visibleFixture({
  width: 1100,
  render: () => (
    <Layout
      width={1100}
      plan={{ tasks: list.tasks.map((task) => ({ ...task, status: 'completed' })) }}
    />
  )
})
export const saveError = visibleFixture({
  width: 360,
  render: () => <Layout width={360} plan={{ ...list, saveError: 'failed' }} />
})
export const collapsed = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: (frame) => {
    frame.querySelector<HTMLElement>('aside button')?.click()
  }
})

export const defaultHidden = defineFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: async (frame) => {
    const toggle = frame.querySelector<HTMLButtonElement>('button[aria-pressed]')
    if (toggle?.getAttribute('aria-pressed') !== 'false' || frame.querySelector('aside')) {
      throw new Error('Milestones must start hidden')
    }
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (toggle.getAttribute('aria-pressed') !== 'true' || !frame.querySelector('aside')) {
      throw new Error('The composer toggle must show milestones')
    }
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (toggle.getAttribute('aria-pressed') !== 'false' || frame.querySelector('aside')) {
      throw new Error('The composer toggle must hide milestones')
    }
  }
})

export const bottomDock = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: async (frame) => {
    frame
      .querySelector<HTMLButtonElement>('button[aria-label="Move milestones to the bottom"]')
      ?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (
      frame.querySelector('aside') ||
      !frame.querySelector('button[aria-label="Move milestones to the right"]')
    ) {
      throw new Error('Milestones must move to the composer tray and offer a return to the right')
    }
  }
})

export const fullHeight = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: async (frame) => {
    frame
      .querySelector<HTMLButtonElement>('button[aria-label="Maximize milestone height"]')
      ?.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const restore = frame.querySelector<HTMLButtonElement>(
      'button[aria-label="Restore milestone height"]'
    )
    if (restore?.getAttribute('aria-pressed') !== 'true') {
      throw new Error('Full-height mode must offer restore')
    }
  }
})

export const waiting = visibleFixture({
  width: 360,
  render: () => (
    <Layout
      width={360}
      plan={{
        ...list,
        tasks: [
          list.tasks[0],
          {
            ...list.tasks[1],
            status: 'pending',
            blocker: { kind: 'waiting', reason: 'Deploy to staging or production?' }
          },
          list.tasks[2]
        ]
      }}
    />
  )
})
export const parallel = visibleFixture({
  width: 1100,
  render: () => (
    <Layout
      width={1100}
      plan={{
        ...list,
        tasks: list.tasks.map((task) =>
          task.status === 'completed' ? task : { ...task, parallelGroup: 'build' }
        )
      }}
    />
  )
})

export const extraWide = visibleFixture({ width: 1800, render: () => <Layout width={1800} /> })
export const restoredHeight = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: async (frame) => {
    const restore = frame.querySelector<HTMLButtonElement>(
      'button[aria-label="Restore milestone height"]'
    )
    if (restore?.getAttribute('aria-pressed') !== 'true') {
      throw new Error('Milestones must default to full height')
    }
    restore.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (
      !frame.querySelector('button[aria-label="Maximize milestone height"][aria-pressed="false"]')
    ) {
      throw new Error('Restoring height must offer maximize')
    }
  }
})

export const expandedDetails = visibleFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: async (frame) => {
    const row = [...frame.querySelectorAll<HTMLButtonElement>('li button')].find((button) =>
      button.textContent?.includes('Implement automatic milestones')
    )
    if (!row) {
      throw new Error('Milestone with technical notes must be expandable')
    }
    if (row.getAttribute('aria-expanded') !== 'true') {
      row.click()
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (!frame.querySelector('[data-native-chat-member-detail] ul')) {
      throw new Error('Technical notes must render as bullets')
    }
    if (!frame.querySelector('a[href="https://example.com/issues/42"]')) {
      throw new Error('Known work item URL must be a link in expanded detail')
    }
  }
})
