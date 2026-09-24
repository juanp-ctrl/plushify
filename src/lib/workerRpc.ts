export interface ProgressInfo {
  /** 0–1, or undefined when indeterminate */
  value?: number
  label: string
}

type Pending = {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  onProgress?: (p: ProgressInfo) => void
}

export type WorkerResponse =
  | { id: number; type: 'progress'; progress: ProgressInfo }
  | { id: number; type: 'result'; result: unknown }
  | { id: number; type: 'error'; error: string }

/** Minimal promise-based RPC over a Web Worker with progress events. */
export class WorkerRpc {
  private nextId = 1
  private pending = new Map<number, Pending>()
  private worker: Worker
  /** True once the worker has crashed; callers should create a new one. */
  dead = false

  constructor(worker: Worker) {
    this.worker = worker
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data
      const p = this.pending.get(msg.id)
      if (!p) return
      if (msg.type === 'progress') p.onProgress?.(msg.progress)
      else {
        this.pending.delete(msg.id)
        if (msg.type === 'result') p.resolve(msg.result)
        else p.reject(new Error(msg.error))
      }
    }
    worker.onerror = (e) => {
      this.dead = true
      worker.terminate()
      const err = new Error(e.message || 'The AI worker crashed (the device may be low on memory).')
      for (const p of this.pending.values()) p.reject(err)
      this.pending.clear()
    }
  }

  call<T>(type: string, payload: unknown, opts: { onProgress?: (p: ProgressInfo) => void; signal?: AbortSignal; transfer?: Transferable[] } = {}): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      if (opts.signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'))
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress: opts.onProgress })
      opts.signal?.addEventListener('abort', () => {
        // The worker keeps computing, but we stop waiting for it.
        if (this.pending.delete(id)) reject(new DOMException('Cancelled', 'AbortError'))
      })
      this.worker.postMessage({ id, type, payload }, opts.transfer ?? [])
    })
  }
}
