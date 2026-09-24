import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { ErrorBanner } from '../ui/ErrorBanner.tsx'
import { deleteCreation, listCreations, type Creation } from './db.ts'
import { loadGlb } from '../viewer/loadGlb.ts'
import { useApp } from '../store.ts'

export function GalleryScreen() {
  const { go, setModel } = useApp()
  const [items, setItems] = useState<Creation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  useEffect(() => {
    listCreations().then(setItems, (e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const thumbs = useMemo(() => new Map(items?.map((c) => [c.id, URL.createObjectURL(c.thumbnail)])), [items])
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs])

  async function open(c: Creation) {
    setOpening(c.id)
    try {
      const model = await loadGlb(c.glb, c.mode)
      setModel({ ...model, galleryId: c.id, savedAt: 'saved' })
      go('viewer')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOpening(null)
    }
  }

  async function remove(id: string) {
    await deleteCreation(id)
    setItems((list) => list?.filter((c) => c.id !== id) ?? null)
  }

  return (
    <main className="safe-top safe-bottom mx-auto flex h-full max-w-2xl flex-col gap-4 px-4">
      <header className="flex items-center justify-between pt-2">
        <Button variant="ghost" className="px-3 py-2" onClick={() => go('home')}>← Back</Button>
        <h2 className="text-lg font-semibold">Gallery</h2>
        <span className="w-16" />
      </header>
      {error && <ErrorBanner message={error} />}
      {items === null && !error && <p className="text-center text-zinc-400">Loading…</p>}
      {items?.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-zinc-400">
          <p>No creations yet. Your 3D models are saved here automatically.</p>
          <Button onClick={() => go('camera')}>Take a photo</Button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 overflow-y-auto pb-4 sm:grid-cols-3">
        {items?.map((c) => (
          <li key={c.id} className="relative overflow-hidden rounded-2xl bg-zinc-900">
            <button className="block w-full" onClick={() => open(c)} disabled={!!opening} aria-label={`Open creation from ${new Date(c.createdAt).toLocaleString()}`}>
              <img src={thumbs.get(c.id)} alt="" className={`aspect-square w-full object-cover ${opening === c.id ? 'animate-pulse' : ''}`} />
              <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-400">
                <span>{new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span>{c.mode === 'cloud' ? '☁️' : '⚡'}</span>
              </div>
            </button>
            <button
              onClick={() => remove(c.id)}
              className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
              aria-label="Delete creation"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
