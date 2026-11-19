import { defineFixture } from '../../../../component-fixtures/component-fixture'

export const headings = defineFixture({
  width: 720,
  setup: () => {
    document.documentElement.style.removeProperty('--text-link')
  },
  render: () => (
    <div className="grid grid-cols-2 gap-8 bg-background p-6 text-foreground">
      {['rich-markdown-editor', 'markdown-body'].map((className) => (
        <div key={className} className={className} style={{ fontSize: 16 }}>
          <h1>Document title</h1>
          <p>
            Body text stays at your preferred size, with <code>inline code</code>.
          </p>
          <h2>Section heading</h2>
          <p>A more compact hierarchy keeps the content easy to scan.</p>
          <h3>Subsection heading</h3>
          <h4>Small heading</h4>
          <h5>Minor heading</h5>
          <details className="orca-details" data-orca-toggle="heading-1" open>
            <summary>Collapsible title</summary>
            <p>Collapsible headings follow the same scale.</p>
          </details>
        </div>
      ))}
    </div>
  )
})

export const appAccent = defineFixture({
  ...headings,
  setup: () => {
    document.documentElement.style.setProperty('--text-link', 'var(--callout-important)')
  }
})
