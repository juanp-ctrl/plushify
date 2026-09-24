import fs from 'node:fs/promises'
import { ProviderError, type JobInfo, type ProviderAdapter } from './types.ts'

/**
 * Fake provider for development and testing the cloud flow without an API key or credits.
 * Returns MOCK_GLB_PATH after MOCK_DURATION_MS. MOCK_FAIL=error|timeout simulates failures.
 */
export class MockProvider implements ProviderAdapter {
  readonly name = 'mock'
  readonly canRig = false
  private jobs = new Map<string, number>()
  private duration = Number(process.env.MOCK_DURATION_MS ?? 6000)
  private glbPath = process.env.MOCK_GLB_PATH ?? 'test-assets/Duck.glb'

  async createJob(): Promise<string> {
    if (process.env.MOCK_FAIL === 'create') throw new ProviderError('The cloud 3D service returned an error (503).')
    const id = `task_mock_${crypto.randomUUID()}`
    this.jobs.set(id, Date.now())
    return id
  }

  async getJob(jobId: string): Promise<JobInfo> {
    const started = this.jobs.get(jobId)
    if (!started) throw new ProviderError('Unknown job.', 404)
    const progress = Math.min(100, Math.round(((Date.now() - started) / this.duration) * 100))
    if (process.env.MOCK_FAIL === 'error' && progress > 40) {
      return { status: 'failed', progress, step: 'Failed', error: 'The cloud service could not build this model. Try another photo or use local mode.' }
    }
    if (process.env.MOCK_FAIL === 'timeout') return { status: 'running', progress: Math.min(progress, 90), step: 'Stuffing it with fluff…' }
    if (progress < 10) return { status: 'queued', progress: 0, step: 'Waiting in the cloud queue…' }
    if (progress < 100) return { status: 'running', progress, step: progress < 55 ? 'Stuffing it with fluff…' : 'Sewing the fabric…' }
    return { status: 'success', progress: 100, step: 'Done' }
  }

  async fetchModel(): Promise<Response> {
    const data = await fs.readFile(this.glbPath)
    return new Response(data, { headers: { 'Content-Type': 'model/gltf-binary', 'Content-Length': String(data.length) } })
  }
}
