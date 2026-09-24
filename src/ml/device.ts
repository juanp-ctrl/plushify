export type Device = 'webgpu' | 'wasm'

/**
 * Phones (especially iOS Safari) kill the tab — which looks like a page refresh —
 * when memory runs out. On those devices we use WASM + quantised weights and keep one model loaded at a time.
 */
export function isLowMemoryDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent))
  return mobile || (nav.deviceMemory ?? 8) <= 4
}

let cached: Promise<Device> | undefined

/** WebGPU when a real adapter is available on a desktop-class device (much faster), otherwise WASM. */
export function pickDevice(): Promise<Device> {
  cached ??= (async () => {
    if (isLowMemoryDevice()) return 'wasm'
    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
      if (gpu && (await gpu.requestAdapter())) return 'webgpu'
    } catch {
      /* fall through */
    }
    return 'wasm'
  })()
  return cached
}
