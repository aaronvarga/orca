import './beautiful-ui.css'

// Adapted from Beautiful UI, MIT (c) 2026 Shane Levine; resources/licenses/beautiful-ui/LICENSE.txt.
export function LoadingState(): React.JSX.Element {
  return (
    <span aria-hidden data-beautiful-ui-loader className="grid shrink-0 grid-cols-3 gap-0.5">
      {[90, 180, 270, 0, 90, 180, 90, 180, 270].map((delay, index) => (
        <span
          key={index}
          className="size-1 rounded-xs bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}
