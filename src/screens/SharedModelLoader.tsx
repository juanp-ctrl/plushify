import { useEffect, useState } from 'react'
import { fetchSharedModel } from '../export/share.ts'
import { loadGlb } from '../viewer/loadGlb.ts'
import { Button } from '../ui/Button.tsx'
import { ErrorBanner } from '../ui/ErrorBanner.tsx'
import { ProgressBar } from '../ui/ProgressBar.tsx'
import { useApp } from '../store.ts'

/** Opens a model from a share link (?model=<id>). */
export function SharedModelLoader() {
  const { setModel, go } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [id] = useState(() => new URLSearchParams(location.search).get('model'))

  useEffect(() => {
    history.replaceState(null, '', location.pathname)
    if (!id) return go('home')
    let cancelled = false
    fetchSharedModel(id)
      .then((glb) => loadGlb(glb, 'cloud'))
      .then((model) => {
        if (cancelled) return
        setModel({ ...model, savedAt: 'saved' }) // don't auto-add other people's models to the gallery
        go('viewer')
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [id, go, setModel])

  return (
    <main className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-6">
      {error ? (
        <ErrorBanner message={error}>
          <Button variant="secondary" className="py-2 text-sm" onClick={() => go('home')}>Make your own</Button>
        </ErrorBanner>
      ) : (
        <ProgressBar progress={{ label: 'Opening shared model…' }} />
      )}
    </main>
  )
}
