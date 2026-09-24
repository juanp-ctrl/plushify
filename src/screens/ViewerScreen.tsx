import { useEffect, useState } from 'react'
import { Viewer } from '../viewer/Viewer.tsx'
import { ModelStage } from '../viewer/ModelStage.tsx'
import { AnimationDriver } from '../animations/AnimationDriver.tsx'
import { AnimationControls } from '../animations/AnimationControls.tsx'
import { RigButton } from '../animations/RigButton.tsx'
import { ExportSheet } from '../export/ExportSheet.tsx'
import { useAutoSave } from '../gallery/useAutoSave.ts'
import { useAnimStore } from '../animations/store.ts'
import { Button } from '../ui/Button.tsx'
import { useApp } from '../store.ts'

export function ViewerScreen() {
  const { model, bgColor, setBgColor, go, reset } = useApp()
  const replayIntro = useAnimStore((s) => s.replayIntro)
  const [exporting, setExporting] = useState(false)
  const [thickness, setThickness] = useState(1)
  useEffect(() => setThickness(model?.object.scale.z ?? 1), [model])
  useAutoSave()

  useEffect(() => {
    if (!model) go('home')
  }, [model, go])
  if (!model) return null

  const clips = model.animations?.map((a) => a.name) ?? []
  // Local models are "2.5D": let the user tune how deep they are (kept in the exported GLB)
  const thicknessControl =
    model.mode === 'local'
      ? {
          value: thickness,
          onChange: (v: number) => {
            model.object.scale.z = v
            setThickness(v)
            model.glb = undefined // re-export with the new depth
          },
        }
      : undefined

  return (
    <main className="relative flex h-full flex-col">
      <div className="absolute inset-0">
        <Viewer>
          <ModelStage model={model}>{(pivot, height) => <AnimationDriver model={model} pivot={pivot} height={height} />}</ModelStage>
        </Viewer>
      </div>

      <header className="safe-top pointer-events-none relative z-10 flex items-center justify-between gap-2 px-4">
        <Button variant="ghost" className="pointer-events-auto bg-black/40 px-4 py-2 text-white" onClick={reset}>
          ＋ New
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="pointer-events-auto bg-black/40 px-3 py-2 text-white" onClick={() => go('gallery')} aria-label="Gallery">
            🖼️
          </Button>
          <Button variant="ghost" className="pointer-events-auto bg-black/40 px-3 py-2 text-white" onClick={replayIntro} aria-label="Replay intro">
            ✨
          </Button>
          <label className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-black/40 px-3 py-2 text-sm text-white">
            <span className="sr-only sm:not-sr-only">Background</span>
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent" aria-label="Background color" />
          </label>
        </div>
      </header>

      <section className="safe-bottom relative z-10 mt-auto flex flex-col gap-3 rounded-t-3xl bg-zinc-950/80 px-4 pt-4 backdrop-blur-md">
        <AnimationControls clips={clips} thickness={thicknessControl} />
        <RigButton />
        <Button onClick={() => setExporting(true)}>Save &amp; share</Button>
      </section>
      {exporting && <ExportSheet onClose={() => setExporting(false)} />}
    </main>
  )
}
