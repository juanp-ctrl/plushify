import { useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ProgressBar } from '../ui/ProgressBar.tsx'
import { ErrorBanner } from '../ui/ErrorBanner.tsx'
import { ModeToggle } from '../ui/ModeToggle.tsx'
import { removeBackground } from '../segmentation/removeBackground.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'
import { useApp } from '../store.ts'

export function ReviewScreen() {
  const { photo, cutout, setCutout, go } = useApp()
  const [progress, setProgress] = useState<ProgressInfo>({ label: 'Preparing…' })
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!photo || cutout) return
    const ctrl = new AbortController()
    setError(null)
    removeBackground(photo, { onProgress: setProgress, signal: ctrl.signal })
      .then(setCutout)
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e instanceof Error ? e.message : String(e))
      })
    return () => ctrl.abort()
  }, [photo, cutout, setCutout, attempt])

  useEffect(() => {
    if (!photo) go('home')
  }, [photo, go])

  if (!photo) return null

  return (
    <main className="safe-top safe-bottom mx-auto flex h-full max-w-md flex-col gap-4 px-6">
      <h2 className="pt-2 text-xl font-semibold">{cutout ? 'Looking good?' : 'Cutting out your object…'}</h2>

      <div className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl ${cutout ? 'checkerboard' : 'bg-zinc-900'}`}>
        <img
          src={cutout?.url ?? photo.url}
          alt={cutout ? 'Object with background removed' : 'Captured photo'}
          className={`max-h-full max-w-full object-contain transition ${cutout ? '' : 'opacity-60 blur-[1px]'}`}
        />
      </div>

      {!cutout && !error && <ProgressBar progress={progress} />}
      {error && (
        <ErrorBanner message={error}>
          <Button variant="secondary" className="py-2 text-sm" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
        </ErrorBanner>
      )}

      {cutout && <ModeToggle />}

      <div className="grid grid-cols-2 gap-3 pb-2">
        <Button variant="secondary" onClick={() => go('camera')}>Retake</Button>
        <Button disabled={!cutout} onClick={() => go('generating')}>Continue</Button>
      </div>
    </main>
  )
}
