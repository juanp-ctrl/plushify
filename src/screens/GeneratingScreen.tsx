import { useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ProgressBar } from '../ui/ProgressBar.tsx'
import { ErrorBanner } from '../ui/ErrorBanner.tsx'
import { getGenerator } from '../generation/index.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'
import { useApp } from '../store.ts'

export function GeneratingScreen() {
  const { cutout, mode, setMode, setModel, go } = useApp()
  const [progress, setProgress] = useState<ProgressInfo>({ label: 'Starting…', value: 0 })
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!cutout) return go('home')
    const ctrl = new AbortController()
    const started = performance.now()
    setError(null)
    getGenerator(mode)
      .generate({ cutout }, setProgress, ctrl.signal)
      .then((model) => {
        console.info(`[snap3d] ${mode} model generated in ${((performance.now() - started) / 1000).toFixed(1)}s`)
        setModel(model)
        go('viewer')
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') setError(e instanceof Error ? e.message : String(e))
      })
    return () => ctrl.abort()
  }, [cutout, mode, attempt, go, setModel])

  return (
    <main className="safe-top safe-bottom mx-auto flex h-full max-w-md flex-col gap-6 px-6">
      <h2 className="pt-2 text-xl font-semibold">Making your plushie…</h2>
      <div className="checkerboard flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl">
        {cutout && <img src={cutout.url} alt="" className="max-h-[80%] max-w-[80%] animate-pulse object-contain" />}
      </div>
      {error ? (
        <ErrorBanner message={error}>
          <Button variant="secondary" className="py-2 text-sm" onClick={() => setAttempt((a) => a + 1)}>Try again</Button>
          {mode === 'cloud' && (
            <Button variant="secondary" className="py-2 text-sm" onClick={() => setMode('local')}>Try local mode</Button>
          )}
        </ErrorBanner>
      ) : (
        <ProgressBar progress={progress} />
      )}
      <Button variant="ghost" onClick={() => go('review')}>Cancel</Button>
    </main>
  )
}
