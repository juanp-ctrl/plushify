import { mlWorker } from '../ml/client.ts'
import { canvasToBlob, createCanvas, type LoadedImage } from '../lib/image.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'
import type { MaskResult } from './rmbg.ts'

export interface Cutout {
  /** Transparent PNG of the object, cropped to its bounding box (+ padding). */
  blob: Blob
  url: string
  /** Same crop of the original photo, background included (better input for depth estimation). */
  cropBlob: Blob
  /** 0–255 alpha mask of the crop. */
  mask: Uint8Array
  width: number
  height: number
}

const FG_THRESHOLD = 128
const PADDING = 0.06

export async function removeBackground(
  image: LoadedImage,
  opts: { onProgress?: (p: ProgressInfo) => void; signal?: AbortSignal } = {},
): Promise<Cutout> {
  const mask = await mlWorker().call<MaskResult>('segment', { blob: image.blob }, opts)
  return composeCutout(image, mask)
}

async function composeCutout(image: LoadedImage, mask: MaskResult): Promise<Cutout> {
  const bitmap = await createImageBitmap(image.blob)
  const { width, height } = mask
  const full = createCanvas(width, height)
  const ctx = full.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Bounding box of the foreground
  let minX = width, minY = height, maxX = -1, maxY = -1, count = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask.data[y * width + x] >= FG_THRESHOLD) {
        count++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (count < width * height * 0.01) {
    throw new Error('No object found in the photo. Try again with the object centered and a plain background.')
  }

  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * PADDING)
  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const cw = Math.min(width, maxX + pad + 1) - x0
  const ch = Math.min(height, maxY + pad + 1) - y0

  const crop = createCanvas(cw, ch)
  const cropCtx = crop.getContext('2d', { willReadFrequently: true })!
  cropCtx.drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch)
  const cropBlob = await canvasToBlob(crop, 'image/jpeg', 0.92)

  const pixels = cropCtx.getImageData(0, 0, cw, ch)
  const cropMask = new Uint8Array(cw * ch)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const a = mask.data[(y + y0) * width + (x + x0)]
      cropMask[y * cw + x] = a
      pixels.data[(y * cw + x) * 4 + 3] = a
    }
  }
  cropCtx.putImageData(pixels, 0, 0)
  const blob = await canvasToBlob(crop, 'image/png')

  return { blob, url: URL.createObjectURL(blob), cropBlob, mask: cropMask, width: cw, height: ch }
}
