import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import type { GeneralSubPage } from '../general/general-sub-pages'

type SettingsLocation = {
  activeSectionId: string
  generalSubPage: GeneralSubPage | null
  scrollTop: number
}

const locations = new Map<string | null, SettingsLocation>()

export function useSettingsLocation() {
  const profileId = useAppStore((state) => state.activeOrcaProfileId)
  const [saved] = useState(() =>
    useAppStore.getState().settingsNavigationTarget ? undefined : locations.get(profileId)
  )
  const [activeSectionId, setActiveSectionId] = useState(saved?.activeSectionId ?? 'general')
  const [generalSubPage, setGeneralSubPage] = useState<GeneralSubPage | null>(
    saved?.generalSubPage ?? null
  )
  const location = useRef({ activeSectionId, generalSubPage })
  const scrollNode = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    location.current = { activeSectionId, generalSubPage }
  }, [activeSectionId, generalSubPage])
  const rememberSettingsScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      const previous = scrollNode.current
      if (previous) {
        locations.set(profileId, { ...location.current, scrollTop: previous.scrollTop })
      }
      scrollNode.current = node
      if (node && saved) {
        node.scrollTop = saved.scrollTop
      }
    },
    [profileId, saved]
  )

  return {
    activeSectionId,
    setActiveSectionId,
    generalSubPage,
    setGeneralSubPage,
    rememberSettingsScrollNode
  }
}
