# Native chat typography and color

Read before changing anything under `src/renderer/src/components/native-chat/`. Core rules: [`docs/STYLEGUIDE.md`](../STYLEGUIDE.md). `pnpm lint` enforces the type scale, softened-foreground, and focus-ring rules below (`config/ast-grep/rules/native-chat-*.yml`).

## Chat type scale

The native chat uses these steps and no others. Never write an arbitrary size (`text-[13px]`) inside `components/native-chat/`.

| Step             | Default | Use it for                                                                                                 |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `text-sm`        | 13px    | Anything the user reads: message prose, tool and agent activity rows, card titles and bodies, the composer |
| `text-xs`        | 12px    | Labels, timestamps, counters, secondary lines under a row                                                  |
| `text-2xs`       | 11px    | Captions, attribution, uppercase category labels                                                           |
| `text-3xs`       | 10px    | Badges and mono pills                                                                                      |
| `text-chat-code` | 12px    | Code blocks, diffs, commands and tool output                                                               |

The chat root (`.native-chat-appearance`) redefines these steps from the Text size setting, so every tier scales together; `text-chat-code` follows the Code text size setting. `text-sm` is the Text size itself, on one line height for prose and list items (20px at 13px). The smaller steps, the spacing unit, icons, padding and row heights follow the UI size: the Text size, except 14px at the 13px default, so they keep their earlier sizes (spacing 4px).

- Use spacing-scale utilities (`size-3.5`, `min-h-6.5`, `pl-3.25`), not pixel lengths (`min-h-[26px]`), or the element stays fixed while the rest scales.
- Size an element with one of these utilities only: a CSS rule that sets `font-size` outside a layer silently overrides them.

## Text colour, hover and focus

- **Primary text on the chat canvas** uses `text-chat-foreground`, and `text-chat-foreground-strong` for titles, hover and emphasis; both follow the Contrast setting. Markdown bold and headings keep the surrounding text color and stand out by weight. Don't soften `text-foreground` by hand (`text-foreground/85`). `text-foreground` is for text on a lifted surface inside the chat.
- **Secondary text on the chat canvas** (transcript rows, notices, labels between messages) uses `text-chat-foreground-faint`. `text-muted-foreground` is for text on a lifted surface inside the chat: cards, menus, popovers and the docks above the composer.
- **Row hover** in the transcript is `hover:bg-accent/20`. Buttons, menu items and card controls use `hover:bg-accent`.
- **Focus rings:** full-width transcript rows use the inset ring (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`) so it isn't clipped by the scroll container; standalone controls use `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. Inside the chat `--ring` is `--chat-focus-ring`, which clears 3:1 on the canvas; don't lower its opacity.
- **Theme overrides:** plugin themes can set `--chat-bold-foreground`, `--chat-muted-foreground`, `--chat-inline-code`, `--chat-inline-code-foreground`, `--chat-code-block`, `--chat-selection` and `--chat-selection-foreground`. They feed `text-chat-foreground-faint`, `bg-chat-inline-code-surface`, `bg-chat-code-surface` and the chat root's `::selection`, so use those rather than reading the theme tokens directly.
- **Selection** inside the chat is the link hue mixed into the canvas (close to the system highlight), with selected text in the full foreground so every role stays 4.5:1. Don't add per-component `selection:` colors in transcript text.
- **State colours:** warnings use `text-chat-warning`; diff lines use `text-chat-diff-added` / `text-chat-diff-removed`; what the reader has not seen yet uses `text-chat-unread`. They are mixed toward the foreground so they pass text contrast in light and dark. Don't use raw palette colours (`text-yellow-500`) or the git decoration tokens for text on a tinted row.

## Chat composition

The chat uses adapted React components from [Beautiful UI](https://www.beautifului.dev/) under `components/native-chat/beautiful-ui/` (MIT; `resources/licenses/beautiful-ui/LICENSE.txt`). Orca owns transport, drafts, Markdown, disclosure persistence, and virtualized scrolling; these components own presentation.

- `PromptBar` keeps a full-width editor at least two lines tall above the leading actions and model/send controls, without remounting the editor. Use `rounded-xl` for the compact bar and `rounded-3xl` for the expanded bar, matching the source's rounded/pill composition through the existing spacing scale.
- `ToolChips` starts collapsed. Explicit reader disclosure choices and requested diff reveals still win. Keep the chevron, icon, summary and outcome counts vertically centered. Expanded runs include confirmed changed-file chips with recorded line counts, overflow disclosure and expandable existing patches. Tool targets fill inset chips, and their leading icon reveals an expansion chevron on hover/open.
- `ThinkingState` uses a compact disclosure and an indented trace; the single live tail uses Beautiful UI's `LoadingState` pixel grid with a CSS-only reduced-motion fallback, the current activity and real turn clock. Turn headers show duration summaries only after settlement.
- `StreamingText` groups the response with its actual agent label and existing response actions. Do not manufacture sources or follow-up suggestions.
- `ApprovalCard` is a compact decision surface with option rows and an action footer. Long plan approvals can use the conversation width. Permission decisions remain inside `SecuritySurface`.
- Claude task progress comes from successful `TaskCreate`, `TaskUpdate`, `TaskGet` and `TaskList` results, alongside legacy `TodoWrite` and Codex plans. The composer task list starts expanded; reader collapse choices persist while it updates.
- `TaskRows` groups the provider's actual tasks into bordered lists with status badges and numbered activity rings. Rows expand only when the provider supplies distinct active wording, an outcome, error or output path; do not invent subtasks or progress percentages. At narrow widths, status badges sit below labels. `CodeBlock` uses a language header, copy/wrap controls, and a numbered gutter when unwrapped; the gutter is excluded from copying.
- Preserve light/dark themes, chat text/code sizes, contrast settings, and the existing canonical tokens in every port. Do not copy gallery demo timers, data, browser portals, fonts, or shaders.
