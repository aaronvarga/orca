import { questionMessages, questionReceipts } from './native-chat-session-questions-fixture-data'
import { resourceMessages } from './native-chat-session-resources-fixture-data'
import {
  Layout,
  list,
  visibleFixture,
  milestoneFixture
} from './native-chat-milestone-layout-test-fixture'

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
export const collapsed = milestoneFixture({ width: 1100, render: () => <Layout width={1100} /> })
export const defaultCollapsed = milestoneFixture({
  width: 1100,
  render: () => <Layout width={1100} />,
  interact: async (frame) => {
    const header = frame.querySelector<HTMLButtonElement>(
      '[data-native-chat-milestone-panel] button[aria-expanded]'
    )
    const toggle = frame.querySelector<HTMLButtonElement>('button[aria-pressed]')
    if (
      header?.getAttribute('aria-expanded') !== 'false' ||
      toggle?.getAttribute('aria-pressed') !== 'true'
    ) {
      throw new Error('Milestones must start attached and collapsed')
    }
    header.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (
      header.getAttribute('aria-expanded') !== 'true' ||
      !frame.querySelector('[role="tabpanel"]')
    ) {
      throw new Error('Expanding the pinned header must show milestone content')
    }
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (frame.querySelector('[data-native-chat-milestone-panel]')) {
      throw new Error('The composer toggle must hide the attached section')
    }
    toggle.click()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    if (
      frame
        .querySelector('[data-native-chat-milestone-panel] button[aria-expanded]')
        ?.getAttribute('aria-expanded') !== 'true'
    ) {
      throw new Error('Showing milestones again must keep the disclosure choice')
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

function rightDockFixture(width: number) {
  return visibleFixture({
    width,
    render: () => <Layout width={width} />,
    interact: async (frame) => {
      frame
        .querySelector<HTMLButtonElement>('button[aria-label="Move milestones to the right"]')!
        .click()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const side = frame.querySelector('aside')!
      const panel = [
        ...frame.querySelectorAll<HTMLElement>('[data-native-chat-milestone-panel]')
      ].filter((element) => element.getBoundingClientRect().width > 0)
      if (panel.length !== 1 || side.contains(panel[0]) !== width >= 1000) {
        throw new Error(
          'Right docking must use the side panel on wide panes and the composer on narrow panes'
        )
      }
      const composer = frame.querySelector('[data-fixture-composer]')!.getBoundingClientRect()
      if (width >= 1000 && composer.right > side.getBoundingClientRect().left) {
        throw new Error('The composer must leave room for the pinned milestones')
      }
    }
  })
}
export const rightDock = rightDockFixture(1100)
export const rightDockNarrow = rightDockFixture(720)
export const rightDockMobile = rightDockFixture(360)

function resourcesFixture(width: number, right = false, empty = false) {
  return visibleFixture({
    width,
    render: () => <Layout width={width} messages={empty ? [] : resourceMessages} />,
    interact: async (frame) => {
      const files = frame.querySelector<HTMLElement>(
        '[role="tab"][data-state="inactive"][id$="trigger-resources"]'
      )!
      files.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (right) {
        frame
          .querySelector<HTMLButtonElement>('button[aria-label="Move milestones to the right"]')!
          .click()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
      const panels = [
        ...frame.querySelectorAll<HTMLElement>('[data-native-chat-session-resources]')
      ].filter((panel) => panel.getBoundingClientRect().width > 0)
      if (
        panels.length !== 1 ||
        (!empty && !panels[0].textContent?.includes('Architecture brief.md'))
      ) {
        throw new Error(
          'The files view must show one shared resource index in either docking position'
        )
      }
      if (!empty) {
        const disclosure = panels[0].querySelector<HTMLButtonElement>('button[aria-expanded]')!
        const changes = disclosure.closest('[data-slot="collapsible"]')!
        if (
          disclosure.getAttribute('aria-expanded') !== 'false' ||
          changes.textContent?.includes('config.ts')
        ) {
          throw new Error('Routine changes must start collapsed')
        }
        disclosure.click()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (!changes.textContent?.includes('config.ts')) {
          throw new Error('Expanding changed files must reveal routine edits')
        }
        disclosure.click()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
      if (panels[0].scrollWidth > panels[0].clientWidth + 1) {
        throw new Error('Resource rows must fit a narrow dock')
      }
    }
  })
}
export const filesBottom = resourcesFixture(1100)
export const filesRight = resourcesFixture(1100, true)
export const filesMobile = resourcesFixture(360, true)
export const filesEmpty = resourcesFixture(720, false, true)

function questionsFixture(width: number, right = false, empty = false) {
  return visibleFixture({
    width,
    render: () => (
      <Layout
        width={width}
        messages={empty ? [] : questionMessages}
        receipts={empty ? undefined : questionReceipts}
      />
    ),
    interact: async (frame) => {
      frame
        .querySelector<HTMLElement>('[role="tab"][id$="trigger-questions"]')!
        .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (right) {
        frame
          .querySelector<HTMLButtonElement>('button[aria-label="Move milestones to the right"]')!
          .click()
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
      const panel = [
        ...frame.querySelectorAll<HTMLElement>('[data-native-chat-session-questions]')
      ].find((element) => element.getBoundingClientRect().width > 0)!
      if (
        !panel ||
        (!empty && !panel.textContent?.includes('Live transcript · Claude conversation'))
      ) {
        throw new Error('Q&A must show the recorded answers')
      }
      if (panel.scrollWidth > panel.clientWidth + 1) {
        throw new Error('Questions and answers must fit the dock')
      }
      const tabs = panel
        .closest('[role="tabpanel"]')!
        .parentElement!.querySelector<HTMLElement>('[role="tablist"]')!
      if (tabs.scrollWidth > tabs.clientWidth + 1) {
        throw new Error('All progress tabs must fit the dock')
      }
    }
  })
}
export const questionsBottom = questionsFixture(1100)
export const questionsRight = questionsFixture(1100, true)
export const questionsMobile = questionsFixture(360, true)
export const questionsEmpty = questionsFixture(720, false, true)
