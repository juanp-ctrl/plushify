import { useEffect } from 'react'
import { getGlb } from '../export/exportGlb.ts'
import { captureThumbnail } from '../viewer/canvasRef.ts'
import { saveCreation } from './db.ts'
import { useApp } from '../store.ts'

/** Saves each new (or newly rigged) model to the IndexedDB gallery once it has rendered. */
export function useAutoSave() {
  const model = useApp((s) => s.model)
  useEffect(() => {
    if (!model || model.savedAt === 'saved') return
    const timer = setTimeout(async () => {
      try {
        const [thumbnail, glb] = await Promise.all([captureThumbnail(), getGlb(model)])
        if (!thumbnail) return
        const id = model.galleryId ?? crypto.randomUUID()
        await saveCreation({ id, createdAt: Date.now(), mode: model.mode, thumbnail, glb })
        model.galleryId = id
        model.savedAt = 'saved'
        if (!model.glb) model.glb = glb // reuse the exported file for downloads/sharing
      } catch (e) {
        console.warn('[snap3d] could not save to gallery', e)
      }
    }, 1800) // after the pop-in intro
    return () => clearTimeout(timer)
  }, [model])
}
