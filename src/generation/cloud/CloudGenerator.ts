import { createJob, downloadModel, pollJob } from '../../lib/api.ts'
import { loadGlb } from '../../viewer/loadGlb.ts'
import type { GeneratedModel, GenerationInput, ModelGenerator } from '../types.ts'
import type { ProgressInfo } from '../../lib/workerRpc.ts'

/** High-quality mode: the backend proxies an image-to-3D provider (keys stay on the server). */
export class CloudGenerator implements ModelGenerator {
  readonly mode = 'cloud' as const

  async generate({ cutout }: GenerationInput, onProgress: (p: ProgressInfo) => void, signal: AbortSignal): Promise<GeneratedModel> {
    onProgress({ label: 'Uploading photo…', value: 0.02 })
    const { jobId } = await createJob(cutout.blob, signal)

    await pollJob(jobId, {
      signal,
      onUpdate: (job) => onProgress({ label: job.step, value: 0.05 + 0.85 * (job.progress / 100) }),
    })

    onProgress({ label: 'Downloading 3D model…', value: 0.9 })
    const glb = await downloadModel(jobId, (v) => onProgress({ label: 'Downloading 3D model…', value: 0.9 + 0.1 * v }), signal)
    const model = await loadGlb(glb, 'cloud')
    return { ...model, jobId }
  }
}
