import { AutoModel, AutoProcessor, RawImage, type PreTrainedModel, type Processor } from '@huggingface/transformers'
import { pickDevice } from '../ml/device.ts'
import { downloadTracker } from '../ml/downloadProgress.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'

// Runs inside the ML web worker.
const MODEL_ID = 'briaai/RMBG-1.4'

let loading: Promise<{ model: PreTrainedModel; processor: Processor }> | undefined

function load(onProgress: (p: ProgressInfo) => void) {
  loading ??= (async () => {
    const device = await pickDevice()
    const progress_callback = downloadTracker('Downloading background-removal model', onProgress)
    const [model, processor] = await Promise.all([
      AutoModel.from_pretrained(MODEL_ID, {
        config: { model_type: 'custom' } as never,
        device,
        dtype: device === 'webgpu' ? 'fp16' : 'q8',
        progress_callback,
      }),
      AutoProcessor.from_pretrained(MODEL_ID, {
        config: {
          do_normalize: true,
          do_pad: false,
          do_rescale: true,
          do_resize: true,
          image_mean: [0.5, 0.5, 0.5],
          feature_extractor_type: 'ImageFeatureExtractor',
          image_std: [1, 1, 1],
          resample: 2,
          rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        } as never,
      }),
    ])
    return { model, processor }
  })()
  loading.catch(() => (loading = undefined))
  return loading
}

/** Frees the model's memory (it will be reloaded from the browser cache when needed again). */
export async function unloadSegmentation() {
  const current = loading
  loading = undefined
  if (current) await (await current.catch(() => null))?.model.dispose()
}

export interface MaskResult {
  data: Uint8Array
  width: number
  height: number
}

/** Returns a single-channel 0–255 foreground mask with the same size as the input image. */
export async function segment(blob: Blob, onProgress: (p: ProgressInfo) => void): Promise<MaskResult> {
  onProgress({ label: 'Loading background-removal model…' })
  const { model, processor } = await load(onProgress)
  onProgress({ label: 'Removing background…' })
  const image = await RawImage.fromBlob(blob)
  const { pixel_values } = await processor(image)
  const { output } = await model({ input: pixel_values })
  const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height)
  return { data: new Uint8Array(mask.data), width: mask.width, height: mask.height }
}
