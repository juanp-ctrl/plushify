import { useRef, useState } from 'react'
import { useCamera } from '../camera/useCamera.ts'
import { UploadButton } from '../camera/UploadButton.tsx'
import { Button } from '../ui/Button.tsx'
import { ErrorBanner } from '../ui/ErrorBanner.tsx'
import { loadAndDownscale } from '../lib/image.ts'
import { useApp } from '../store.ts'

export function CameraScreen() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { status, error, facing, canSwitch, switchCamera, capture, stop } = useCamera(videoRef)
  const { go, setPhoto } = useApp()
  const [busy, setBusy] = useState(false)
  const [captureError, setCaptureError] = useState<string | null>(null)

  async function onCapture() {
    setBusy(true)
    setCaptureError(null)
    try {
      const blob = await capture()
      setPhoto(await loadAndDownscale(blob))
      stop()
      go('review')
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <main className="relative flex h-full flex-col bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
      />

      {status === 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="aspect-square w-[72%] max-w-sm rounded-[2rem] border-2 border-dashed border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          <p className="mt-4 rounded-full bg-black/60 px-4 py-2 text-sm text-white">Center the object — a plain background works best</p>
        </div>
      )}

      <div className="safe-top relative z-10 flex items-center justify-between px-4">
        <Button variant="ghost" className="bg-black/40 px-4 py-2 text-white" onClick={() => { stop(); go('home') }} aria-label="Close camera">
          ✕
        </Button>
        {canSwitch && status === 'ready' && (
          <Button variant="ghost" className="bg-black/40 px-4 py-2 text-white" onClick={switchCamera} aria-label="Switch camera">
            🔄 Switch
          </Button>
        )}
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        {status === 'starting' && <p className="text-zinc-300">Starting camera…</p>}
        {status === 'error' && error && (
          <div className="flex w-full max-w-md flex-col gap-3">
            <ErrorBanner message={error.message} />
            <UploadButton variant="primary" />
          </div>
        )}
      </div>

      {status === 'ready' && (
        <div className="safe-bottom relative z-10 flex flex-col items-center gap-3 pb-6">
          {captureError && <p className="rounded-lg bg-black/60 px-3 py-1 text-sm text-red-300">{captureError}</p>}
          <button
            onClick={onCapture}
            disabled={busy}
            aria-label="Take photo"
            className="h-20 w-20 rounded-full border-4 border-white bg-white/30 transition active:scale-90 disabled:opacity-50"
          />
        </div>
      )}
    </main>
  )
}
