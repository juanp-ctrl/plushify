/// <reference lib="webworker" />
import type { ProgressInfo, WorkerResponse } from '../lib/workerRpc.ts'
import { isLowMemoryDevice } from './device.ts'

const lowMemory = isLowMemoryDevice()

// A single worker hosts all in-browser models so the ONNX runtime is loaded once
// (important on phones with tight memory limits).
type Handler = (payload: never, progress: (p: ProgressInfo) => void) => Promise<{ result: unknown; transfer?: Transferable[] }>

const handlers: Record<string, () => Promise<Handler>> = {
  segment: async () => {
    const { segment } = await import('../segmentation/rmbg.ts')
    return async (payload: { blob: Blob }, progress) => {
      if (lowMemory) await (await import('../generation/local/depth.ts')).unloadDepth()
      const mask = await segment(payload.blob, progress)
      return { result: mask, transfer: [mask.data.buffer] }
    }
  },
  depth: async () => {
    const { estimateDepth } = await import('../generation/local/depth.ts')
    return async (payload: { blob: Blob }, progress) => {
      if (lowMemory) await (await import('../segmentation/rmbg.ts')).unloadSegmentation()
      const depth = await estimateDepth(payload.blob, progress)
      return { result: depth, transfer: [depth.data.buffer] }
    }
  },
}

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer)

self.onmessage = async (e: MessageEvent<{ id: number; type: string; payload: never }>) => {
  const { id, type, payload } = e.data
  try {
    const factory = handlers[type]
    if (!factory) throw new Error(`Unknown task: ${type}`)
    const handler = await factory()
    const { result, transfer } = await handler(payload, (progress) => post({ id, type: 'progress', progress }))
    post({ id, type: 'result', result }, transfer)
  } catch (err) {
    post({ id, type: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}
