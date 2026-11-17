import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TerminalComposerAttachment } from './terminal-composer-files'

export const useComposerDrafts = create(
  persist<{
    attachments: Record<string, TerminalComposerAttachment[]>
    setAttachments: (key: string, files: TerminalComposerAttachment[]) => void
    drafts: Record<string, string>
    setDraft: (key: string, text: string) => void
  }>(
    (set) => ({
      drafts: {},
      attachments: {},
      setAttachments: (key, files) =>
        set((state) => ({ attachments: { ...state.attachments, [key]: files } })),
      setDraft: (key, text) =>
        set((state) => {
          const drafts = { ...state.drafts }
          if (text) {
            drafts[key] = text
          } else {
            delete drafts[key]
          }
          return { drafts }
        })
    }),
    {
      name: 'orca:terminal-composer-drafts:v1',
      merge: (saved, current) => {
        const drafts = saved && typeof saved === 'object' && 'drafts' in saved ? saved.drafts : null
        return {
          ...current,
          attachments:
            saved &&
            typeof saved === 'object' &&
            'attachments' in saved &&
            saved.attachments &&
            typeof saved.attachments === 'object'
              ? Object.fromEntries(
                  Object.entries(saved.attachments).map(([key, files]) => [
                    key,
                    Array.isArray(files)
                      ? files.filter((file): file is TerminalComposerAttachment =>
                          Boolean(
                            file && typeof file.path === 'string' && typeof file.text === 'string'
                          )
                        )
                      : []
                  ])
                )
              : {},
          drafts:
            drafts && typeof drafts === 'object'
              ? Object.fromEntries(
                  Object.entries(drafts).filter(
                    (entry): entry is [string, string] => typeof entry[1] === 'string'
                  )
                )
              : {}
        }
      }
    }
  )
)
