import type { ProgressInfo } from '../lib/workerRpc.ts'

interface HfProgress {
  status: string
  file?: string
  loaded?: number
  total?: number
}

/** Aggregates transformers.js per-file download events into one progress value. */
export function downloadTracker(label: string, emit: (p: ProgressInfo) => void) {
  const files = new Map<string, { loaded: number; total: number }>()
  return (e: HfProgress) => {
    if (e.status !== 'progress' || !e.file || !e.total) return
    files.set(e.file, { loaded: e.loaded ?? 0, total: e.total })
    let loaded = 0
    let total = 0
    for (const f of files.values()) {
      loaded += f.loaded
      total += f.total
    }
    const mb = (n: number) => (n / 1e6).toFixed(0)
    emit({ value: loaded / total, label: `${label} (${mb(loaded)}/${mb(total)} MB, one time only)` })
  }
}
