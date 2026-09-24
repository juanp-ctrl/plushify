import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ProgressBar } from '../ui/ProgressBar.tsx'
import { getGlb } from './exportGlb.ts'
import { downloadBlob, timestampName } from './download.ts'
import { recordCanvas, videoSupport } from './recordVideo.ts'
import { copyText, createShareLink, nativeShare } from './share.ts'
import { viewerCanvas } from '../viewer/canvasRef.ts'
import { useApp } from '../store.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'
import { BRAND } from '../brand.ts'

type Video = { blob: Blob; ext: string; url: string }

export function ExportSheet({ onClose }: { onClose: () => void }) {
  const model = useApp((s) => s.model)
  const [busy, setBusy] = useState<ProgressInfo | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [video, setVideo] = useState<Video | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const recording = useRef<AbortController | null>(null)
  const canRecord = videoSupport() !== null

  useEffect(() => () => recording.current?.abort(), [])
  useEffect(() => () => void (video && URL.revokeObjectURL(video.url)), [video])
  if (!model) return null

  const run = async (label: string, fn: () => Promise<void>) => {
    setMessage(null)
    setBusy({ label })
    try {
      await fn()
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setMessage({ text: e instanceof Error ? e.message : String(e), error: true })
    } finally {
      setBusy(null)
    }
  }

  const downloadGlb = () =>
    run('Preparing .glb…', async () => {
      downloadBlob(await getGlb(model), timestampName(BRAND.slug, 'glb'))
      setMessage({ text: 'Downloaded .glb ✓' })
    })

  const record = (seconds: number) =>
    run(`Recording ${seconds}s…`, async () => {
      if (!viewerCanvas.current) throw new Error('The 3D view is not ready.')
      recording.current = new AbortController()
      const { blob, ext } = await recordCanvas(viewerCanvas.current, seconds, {
        signal: recording.current.signal,
        onProgress: (v) => setBusy({ label: `Recording ${seconds}s…`, value: v }),
      })
      setVideo({ blob, ext, url: URL.createObjectURL(blob) })
    })

  const share = () =>
    run('Creating link…', async () => {
      const url = link ?? (await createShareLink(await getGlb(model)))
      setLink(url)
      const copied = await copyText(url)
      setMessage({ text: copied ? 'Link copied to clipboard ✓' : 'Copy the link below:' })
    })

  const shareVideo = async () => {
    if (!video) return
    const file = new File([video.blob], timestampName(BRAND.slug, video.ext), { type: video.blob.type })
    const ok = await nativeShare({ title: `My ${BRAND.name} plushie`, files: [file] })
    if (!ok) downloadBlob(video.blob, file.name)
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Export and share"
        className="safe-bottom mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-zinc-900 px-5 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Export &amp; share</h3>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-zinc-400" aria-label="Close">✕</button>
        </div>

        {video ? (
          <div className="flex flex-col gap-3">
            <video src={video.url} controls autoPlay loop playsInline muted className="max-h-[45vh] w-full rounded-2xl bg-black" data-testid="recorded-video" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => downloadBlob(video.blob, timestampName(BRAND.slug, video.ext))}>Save video</Button>
              <Button onClick={shareVideo}>Share video</Button>
            </div>
            <Button variant="ghost" onClick={() => setVideo(null)}>← Back</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={!!busy} onClick={downloadGlb}>⬇️ Download .glb</Button>
            <Button variant="secondary" disabled={!!busy} onClick={share}>🔗 Copy share link</Button>
            <Button variant="secondary" disabled={!!busy || !canRecord} onClick={() => record(5)}>🎬 Record 5s</Button>
            <Button variant="secondary" disabled={!!busy || !canRecord} onClick={() => record(10)}>🎬 Record 10s</Button>
          </div>
        )}

        {!canRecord && <p className="text-xs text-zinc-500">Video recording isn't supported in this browser.</p>}
        {busy && <ProgressBar progress={busy} />}
        {message && <p className={`text-sm ${message.error ? 'text-red-300' : 'text-emerald-300'}`} role="status">{message.text}</p>}
        {link && (
          <div className="flex gap-2">
            <input readOnly value={link} className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-300" onFocus={(e) => e.target.select()} aria-label="Share link" />
            {'share' in navigator && (
              <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => nativeShare({ title: `My ${BRAND.name} plushie`, url: link })}>Share</Button>
            )}
          </div>
        )}
        <p className="pb-2 text-xs text-zinc-500">Share links work for anyone who can reach this server (same Wi-Fi when running locally).</p>
      </div>
    </div>
  )
}
