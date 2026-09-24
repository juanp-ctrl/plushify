/** The live WebGL canvas, for thumbnails and video recording. */
export const viewerCanvas: { current: HTMLCanvasElement | null } = { current: null }

/** Grabs a square-ish JPEG thumbnail of the current frame. */
export async function captureThumbnail(size = 320): Promise<Blob | null> {
  const src = viewerCanvas.current
  if (!src || !src.width) return null
  const side = Math.min(src.width, src.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 0, 0, size, size)
  return new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
}
