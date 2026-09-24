import { useEffect, useRef, useState } from 'react'
import { downloadModel, pollJob, startRig } from '../lib/api.ts'
import { loadGlb } from '../viewer/loadGlb.ts'
import { ProgressBar } from '../ui/ProgressBar.tsx'
import { useApp } from '../store.ts'
import { useAnimStore } from './store.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'

/** Stretch goal: asks the provider to rig the model (people/animals) and add skeletal animations. */
export function RigButton() {
  const { model, setModel, config } = useApp()
  const setCurrent = useAnimStore((s) => s.setCurrent)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ctrl = useRef<AbortController | null>(null)
  useEffect(() => () => ctrl.current?.abort(), [])

  if (!model?.jobId || model.mode !== 'cloud' || !config.rigging || model.animations?.length) return null

  async function run() {
    if (!model?.jobId) return
    ctrl.current = new AbortController()
    const signal = ctrl.current.signal
    setError(null)
    setProgress({ label: 'Starting…', value: 0 })
    try {
      const { jobId } = await startRig(model.jobId, signal)
      await pollJob(jobId, { signal, timeoutMs: 360_000, onUpdate: (j) => setProgress({ label: j.step, value: j.progress / 100 }) })
      setProgress({ label: 'Downloading…' })
      const rigged = await loadGlb(await downloadModel(jobId, () => {}, signal), 'cloud')
      setModel({ ...rigged, jobId: model.jobId, galleryId: model.galleryId })
      if (rigged.animations?.[0]) setCurrent(`clip:${rigged.animations[0].name}`)
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
    }
  }

  if (progress) return <ProgressBar progress={progress} />
  return (
    <div className="flex flex-col gap-1">
      <button onClick={run} className="self-start rounded-xl bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 active:bg-zinc-700">
        🦴 Add skeleton animations (people &amp; animals)
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
