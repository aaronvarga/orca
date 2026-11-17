import { useEffect, useMemo, useRef, useState } from 'react'
import { Grid2X2, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { getRepoLucideIconOptions } from '@/components/repo/repo-icon'
import type { RepoIcon } from '../../../../../../shared/repository/appearance/repo-icon'
import type { ProjectSymbolCatalog } from '../../../../../../shared/repository/appearance/project-symbol-catalog'

const CATEGORY_LABELS: Record<string, string> = {
  whatsnew: "What's New",
  draw: 'Draw',
  variable: 'Variable',
  multicolor: 'Multicolor',
  communication: 'Communication',
  weather: 'Weather',
  maps: 'Maps',
  objectsandtools: 'Objects & Tools',
  devices: 'Devices',
  cameraandphotos: 'Camera & Photos',
  gaming: 'Gaming',
  connectivity: 'Connectivity',
  transportation: 'Transportation',
  automotive: 'Automotive',
  accessibility: 'Accessibility',
  privacyandsecurity: 'Privacy & Security',
  human: 'Human',
  home: 'Home',
  fitness: 'Fitness',
  nature: 'Nature',
  editing: 'Editing',
  textformatting: 'Text Formatting',
  media: 'Media',
  keyboard: 'Keyboard',
  commerce: 'Commerce',
  time: 'Time',
  health: 'Health',
  shapes: 'Shapes',
  arrows: 'Arrows',
  indices: 'Indices',
  math: 'Math'
}

export function RepositorySymbolPicker({
  onSetIcon,
  selectedName,
  onClose
}: {
  onSetIcon: (icon: RepoIcon | null) => void
  selectedName?: string | null
  onClose: () => void
}) {
  const t = useTranslate()
  const [catalog, setCatalog] = useState<ProjectSymbolCatalog | null>()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<Record<string, string>>({})
  const scroll = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(8)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(400)
  useEffect(() => {
    let active = true
    void (window.api.shell.getProjectSymbolCatalog?.() ?? Promise.resolve(null))
      .then((value) => {
        if (active) {
          setCatalog(value)
        }
      })
      .catch(() => {
        if (active) {
          setError(
            t(
              'projectSymbols.loadFailed',
              'Could not load symbols. Reopen the picker to try again.'
            )
          )
          setCatalog(null)
        }
      })
    return () => {
      active = false
    }
  }, [t])
  useEffect(() => {
    const element = scroll.current
    if (!element) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      setColumns(Math.max(1, Math.floor((entry.contentRect.width + 8) / 48)))
      setViewportHeight(entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [catalog])
  const entries = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
    return (catalog?.entries ?? []).filter(
      (entry) =>
        (!category || entry.categories.includes(category)) &&
        words.every((word) => entry.search.includes(word) || entry.name.includes(word))
    )
  }, [catalog, category, query])
  const rowCount = Math.ceil(entries.length / columns)
  const firstRow = Math.max(0, Math.floor(scrollTop / 44) - 2)
  const lastRow = Math.min(rowCount, firstRow + Math.ceil(viewportHeight / 44) + 4)
  const virtualRows = Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, offset) => {
    const index = firstRow + offset
    return { index, key: index, start: index * 44 }
  })
  const visibleNames = virtualRows.flatMap((row) =>
    entries.slice(row.index * columns, (row.index + 1) * columns).map((entry) => entry.name)
  )
  const visibleKey = [
    ...new Set([
      ...visibleNames,
      ...(catalog?.categories.flatMap((item) => (item.icon ? [item.icon] : [])) ?? [])
    ])
  ].join('\0')
  useEffect(() => {
    const missing = visibleKey.split('\0').filter((name) => name && !Object.hasOwn(images, name))
    if (!missing.length || !window.api.shell.renderProjectSymbols) {
      return
    }
    let active = true
    void window.api.shell
      .renderProjectSymbols(missing.slice(0, 128))
      .then((next) => {
        if (active) {
          setImages((current) => ({
            ...current,
            ...Object.fromEntries(missing.slice(0, 128).map((name) => [name, next[name] ?? '']))
          }))
        }
      })
      .catch(() => {
        if (active) {
          setError(
            t(
              'projectSymbols.loadFailed',
              'Could not load symbols. Reopen the picker to try again.'
            )
          )
        }
      })
    return () => {
      active = false
    }
  }, [images, visibleKey, t])
  const choose = (name: string) => {
    const src = images[name]
    if (src) {
      onSetIcon({ type: 'image', source: 'symbol', src, label: name })
      onClose()
    }
  }
  const resetScroll = () => {
    scroll.current?.scrollTo({ top: 0 })
    setScrollTop(0)
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent surface="panel" className="sm:max-w-3xl">
        <div className="flex h-[min(580px,80dvh)] min-h-0 flex-col p-4">
          <DialogHeader>
            <DialogTitle>{t('projectSymbols.title', 'Icon')}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex min-h-0 flex-1 gap-4">
            {catalog ? (
              <nav
                aria-label={t('projectSymbols.categories', 'Symbol categories')}
                className="scrollbar-sleek w-44 max-w-[40%] shrink-0 space-y-1 overflow-y-auto border-r border-border pr-2"
              >
                <Button
                  variant={category === null ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  aria-pressed={category === null}
                  onClick={() => {
                    setCategory(null)
                    resetScroll()
                  }}
                >
                  <Grid2X2 className="size-4" />
                  {t('projectSymbols.all', 'All Symbols')}
                </Button>
                {catalog.categories.map((item) => (
                  <Button
                    key={item.key}
                    variant={category === item.key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    aria-pressed={category === item.key}
                    onClick={() => {
                      setCategory(item.key)
                      resetScroll()
                    }}
                  >
                    <span
                      className="size-4 shrink-0 bg-current"
                      style={{
                        maskImage:
                          item.icon && images[item.icon]
                            ? `url("${images[item.icon]}")`
                            : undefined,
                        maskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        visibility: item.icon && images[item.icon] ? 'visible' : 'hidden'
                      }}
                    />
                    <span className="truncate">
                      {t(
                        `projectSymbols.category.${item.key}`,
                        CATEGORY_LABELS[item.key] ?? item.name
                      )}
                    </span>
                  </Button>
                ))}
              </nav>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Input
                autoFocus
                aria-label={t('projectSymbols.search', 'Search symbols…')}
                placeholder={t('projectSymbols.search', 'Search symbols…')}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  resetScroll()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing && entries[0]) {
                    choose(entries[0].name)
                  }
                }}
              />
              {error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <div
                ref={scroll}
                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                className="scrollbar-sleek relative min-h-0 flex-1 overflow-y-auto"
              >
                {catalog === undefined ? (
                  <Loader2
                    aria-label={t('projectSymbols.loading', 'Loading symbols…')}
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                ) : catalog === null ? (
                  <div className="grid grid-cols-6 gap-2">
                    {getRepoLucideIconOptions()
                      .filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
                      .map((option) => (
                        <Button
                          key={option.name}
                          variant={selectedName === option.name ? 'secondary' : 'ghost'}
                          size="icon-lg"
                          aria-label={option.label}
                          onClick={() => {
                            onSetIcon({ type: 'lucide', name: option.name })
                            onClose()
                          }}
                        >
                          <option.icon className="size-5" />
                        </Button>
                      ))}
                  </div>
                ) : entries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('projectSymbols.empty', 'No symbols found')}
                  </p>
                ) : (
                  <div style={{ height: rowCount * 44 }}>
                    {virtualRows.map((row) => (
                      <div
                        key={row.key}
                        className="absolute inset-x-0 grid gap-2"
                        style={{
                          top: row.start,
                          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
                        }}
                      >
                        {entries
                          .slice(row.index * columns, (row.index + 1) * columns)
                          .map((entry) => (
                            <Tooltip key={entry.name}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={selectedName === entry.name ? 'secondary' : 'ghost'}
                                  size="icon-lg"
                                  aria-label={entry.name}
                                  disabled={!images[entry.name]}
                                  onClick={() => choose(entry.name)}
                                >
                                  {images[entry.name] ? (
                                    <span
                                      className="size-7 bg-current"
                                      style={{
                                        maskImage: `url("${images[entry.name]}")`,
                                        maskSize: 'contain',
                                        maskRepeat: 'no-repeat',
                                        maskPosition: 'center'
                                      }}
                                    />
                                  ) : (
                                    <span className="size-7" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={4}>
                                {entry.name}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {catalog ? (
                <p className="text-2xs text-muted-foreground">
                  {t('projectSymbols.count', '{{count}} symbols', { count: entries.length })}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onSetIcon(null)
                onClose()
              }}
            >
              <X className="size-4" />
              {t('projectSymbols.remove', 'Remove Icon')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
