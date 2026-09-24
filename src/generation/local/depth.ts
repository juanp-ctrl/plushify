import { pipeline, RawImage, type DepthEstimationPipeline } from '@huggingface/transformers'
import { pickDevice } from '../../ml/device.ts'
import { downloadTracker } from '../../ml/downloadProgress.ts'
import type { ProgressInfo } from '../../lib/workerRpc.ts'

// Runs inside the ML web worker.
const MODEL_ID = 'onnx-community/depth-anything-v2-small'

let loading: Promise<DepthEstimationPipeline> | undefined

function load(onProgress: (p: ProgressInfo) => void) {
  loading ??= (async () => {
    const device = await pickDevice()
    return (await pipeline('depth-estimation', MODEL_ID, {
      device,
      dtype: device === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: downloadTracker('Downloading depth model', onProgress),
    })) as DepthEstimationPipeline
  })()
  loading.catch(() => (loading = undefined))
  return loading
}

export async function unloadDepth() {
  const current = loading
  loading = undefined
  if (current) await (await current.catch(() => null))?.dispose()
}

export interface DepthResult {
  /** 0–255, larger = closer to the camera. Same size as the input image. */
  data: Uint8Array
  width: number
  height: number
}

export async function estimateDepth(blob: Blob, onProgress: (p: ProgressInfo) => void): Promise<DepthResult> {
  onProgress({ label: 'Loading depth model…' })
  const estimator = await load(onProgress)
  onProgress({ label: 'Shaping the plushie…' })
  const image = await RawImage.fromBlob(blob)
  const { depth } = await estimator(image)
  return { data: new Uint8Array(depth.data), width: depth.width, height: depth.height }
}
