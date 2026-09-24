export interface LoadedImage {
  blob: Blob
  url: string
  width: number
  height: number
}

/** Decodes an image (respecting EXIF orientation) and downsizes it so the long side is ≤ maxSize. */
export async function loadAndDownscale(source: Blob, maxSize = 1024): Promise<LoadedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This file could not be read as an image. Try a JPG or PNG.')
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
  return { blob, url: URL.createObjectURL(blob), width, height }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality),
  )
}
