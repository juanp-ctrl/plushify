const CANDIDATES = [
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
]

export function videoSupport(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null
}

/** Records the canvas for `seconds` using captureStream + MediaRecorder (MP4 on Safari, WebM elsewhere). */
export function recordCanvas(
  canvas: HTMLCanvasElement,
  seconds: number,
  { onProgress, signal }: { onProgress?: (v: number) => void; signal?: AbortSignal } = {},
): Promise<{ blob: Blob; ext: string }> {
  const format = videoSupport()
  if (!format) return Promise.reject(new Error("This browser can't record video. Try Chrome, Safari 14.1+ or Firefox."))

  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 })
    const chunks: Blob[] = []
    const started = performance.now()
    let timer = 0

    const cleanup = () => {
      clearInterval(timer)
      stream.getTracks().forEach((t) => t.stop())
    }
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    recorder.onerror = () => {
      cleanup()
      reject(new Error('Recording failed.'))
    }
    recorder.onstop = () => {
      cleanup()
      if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'))
      resolve({ blob: new Blob(chunks, { type: format.mime.split(';')[0] }), ext: format.ext })
    }
    signal?.addEventListener('abort', () => recorder.state !== 'inactive' && recorder.stop())

    recorder.start(250)
    timer = window.setInterval(() => {
      const v = (performance.now() - started) / (seconds * 1000)
      onProgress?.(Math.min(1, v))
      if (v >= 1 && recorder.state !== 'inactive') recorder.stop()
    }, 100)
  })
}
