import { fetchWithRetry } from '../http.ts'
import { ProviderError, type ImageInput, type JobInfo, type ProviderAdapter } from './types.ts'

// Tripo API v3 — https://developers.tripo3d.ai/en/docs/introduction
const BASE = 'https://openapi.tripo3d.ai/v3'

interface TripoTask {
  task_id: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'banned' | 'expired'
  progress?: number
  error_code?: number
  error_message?: string
  output?: { model_url?: string; riggable?: boolean; rig_type?: string }
}

const FRIENDLY: Record<number, string> = {
  1000: 'The cloud API key is invalid. Check TRIPO_API_KEY on the server.',
  1001: 'The cloud API key is missing. Check TRIPO_API_KEY on the server.',
  1007: 'The cloud service is busy. Please try again in a minute.',
  2000: 'Too many models are being generated at once. Please try again in a minute.',
  2003: 'The photo was empty. Please retake it.',
  2004: 'Unsupported image format.',
  2008: 'The photo was rejected by the content policy. Try a different object.',
  2010: 'The cloud account is out of credits. Use local mode or top up at platform.tripo3d.ai.',
}

const BIPED_ANIMATIONS = ['preset:biped:walk', 'preset:biped:wave_goodbye_01', 'preset:biped:jump', 'preset:biped:dance_01']
const CREATURE_WALK: Record<string, string> = {
  quadruped: 'preset:quadruped:walk',
  hexapod: 'preset:hexapod:walk',
  octopod: 'preset:octopod:walk',
  serpentine: 'preset:serpentine:march',
  aquatic: 'preset:aquatic:march',
}

/** Multi-step rig pipeline (rig-check → rig → retarget) tracked in memory. */
interface RigChain {
  info: JobInfo
  finalTaskId?: string
}

export class TripoProvider implements ProviderAdapter {
  readonly name = 'tripo'
  readonly canRig = true
  private chains = new Map<string, RigChain>()
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = process.env.TRIPO_MODEL || 'v3.1-20260211') {
    this.apiKey = apiKey
    this.model = model
  }

  private async call<T>(path: string, init: RequestInit = {}, retryOn5xx = true): Promise<T> {
    const res = await fetchWithRetry(
      `${BASE}${path}`,
      { ...init, headers: { Authorization: `Bearer ${this.apiKey}`, ...(init.headers ?? {}) } },
      { retryOn5xx },
    ).catch(() => {
      throw new ProviderError('Could not reach the cloud 3D service. Check your internet connection.', 504)
    })
    const body = (await res.json().catch(() => null)) as { code?: number; data?: T; message?: string } | null
    if (!res.ok || !body || body.code !== 0) {
      const code = body?.code ?? 0
      console.error(`[tripo] ${path} failed: HTTP ${res.status} code=${code} ${body?.message ?? ''}`)
      const message =
        res.status === 401 ? FRIENDLY[1000] : res.status === 429 ? FRIENDLY[1007] : (FRIENDLY[code] ?? `The cloud 3D service returned an error (${res.status}).`)
      throw new ProviderError(message, res.status === 401 ? 500 : 502)
    }
    return body.data as T
  }

  private post<T>(path: string, json: unknown) {
    // Don't blindly retry task creation on 5xx: it could create (and bill) a duplicate task.
    return this.call<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) }, false)
  }

  private task(taskId: string) {
    return this.call<TripoTask>(`/tasks/${encodeURIComponent(taskId)}`)
  }

  async createJob(image: ImageInput): Promise<string> {
    const form = new FormData()
    form.append('file', new Blob([image.data], { type: image.mimeType }), image.filename)
    const { file_token } = await this.call<{ file_token: string }>('/files', { method: 'POST', body: form }, false)
    const { task_id } = await this.post<{ task_id: string }>('/generation/image-to-model', {
      input: file_token,
      model: this.model,
      texture: true,
      pbr: true,
      face_limit: 50_000, // web/mobile friendly
    })
    return task_id
  }

  async getJob(jobId: string): Promise<JobInfo> {
    const chain = this.chains.get(jobId)
    if (chain) return chain.info
    return toJobInfo(await this.task(jobId))
  }

  async fetchModel(jobId: string): Promise<Response> {
    const taskId = this.chains.get(jobId)?.finalTaskId ?? jobId
    const t = await this.task(taskId)
    const url = t.output?.model_url
    if (t.status !== 'success' || !url) throw new ProviderError('The model is not ready yet.', 409)
    const res = await fetchWithRetry(url, {}, { timeoutMs: 120_000 })
    if (!res.ok) throw new ProviderError('Could not download the generated model (it may have expired).', 502)
    return res
  }

  async rig(jobId: string): Promise<string> {
    const id = `rig_${crypto.randomUUID()}`
    const chain: RigChain = { info: { status: 'running', progress: 2, step: 'Checking if it can be rigged…' } }
    this.chains.set(id, chain)
    this.runRig(jobId, chain).catch((err) => {
      chain.info = { status: 'failed', progress: 0, step: 'Failed', error: err instanceof ProviderError ? err.message : 'Rigging failed.' }
    })
    return id
  }

  private async runRig(modelTaskId: string, chain: RigChain) {
    const check = await this.waitFor((await this.post<{ task_id: string }>('/animations/rig-check', { input: modelTaskId })).task_id, chain, 0, 15)
    if (!check.output?.riggable) {
      chain.info = { status: 'failed', progress: 0, step: 'Failed', error: "This object can't be rigged. Skeletal animations work best on people and animals." }
      return
    }
    const rigType = check.output.rig_type ?? 'biped'
    const biped = rigType === 'biped'
    chain.info = { status: 'running', progress: 15, step: `Adding a ${rigType} skeleton…` }
    const rig = await this.waitFor(
      (await this.post<{ task_id: string }>('/animations/rig', {
        input: modelTaskId,
        model: biped ? 'v1.0-20240301' : 'v2.5-20260210',
        rig_type: rigType,
        out_format: 'glb',
      })).task_id,
      chain,
      15,
      60,
    )
    chain.info = { status: 'running', progress: 60, step: 'Teaching it to move…' }
    const animations = biped ? BIPED_ANIMATIONS : [CREATURE_WALK[rigType] ?? 'preset:quadruped:walk']
    const retarget = await this.waitFor(
      (await this.post<{ task_id: string }>('/animations/retarget', {
        input: rig.task_id,
        ...(animations.length > 1 ? { animations } : { animation: animations[0] }),
        out_format: 'glb',
        bake_animation: true,
        animate_in_place: true,
      })).task_id,
      chain,
      60,
      100,
    )
    chain.finalTaskId = retarget.task_id
    chain.info = { status: 'success', progress: 100, step: 'Done' }
  }

  /** Polls a Tripo task, mapping its progress into [from, to] of the chain. */
  private async waitFor(taskId: string, chain: RigChain, from: number, to: number): Promise<TripoTask> {
    const deadline = Date.now() + Number(process.env.JOB_TIMEOUT_MS ?? 180_000)
    while (Date.now() < deadline) {
      const t = await this.task(taskId)
      if (t.status === 'success') return t
      const info = toJobInfo(t)
      if (info.status === 'failed') throw new ProviderError(info.error ?? 'Rigging failed.')
      chain.info = { ...chain.info, progress: Math.round(from + ((to - from) * (t.progress ?? 0)) / 100) }
      await new Promise((r) => setTimeout(r, 2000))
    }
    throw new ProviderError('Rigging took too long. Please try again later.', 504)
  }
}

function toJobInfo(t: TripoTask): JobInfo {
  const progress = Math.max(0, Math.min(100, t.progress ?? 0))
  switch (t.status) {
    case 'queued':
      return { status: 'queued', progress: 0, step: 'Waiting in the cloud queue…' }
    case 'running':
      return { status: 'running', progress, step: progress < 55 ? 'Stuffing it with fluff…' : 'Sewing the fabric…' }
    case 'success':
      return { status: 'success', progress: 100, step: 'Done' }
    case 'banned':
      return { status: 'failed', progress, step: 'Failed', error: FRIENDLY[2008] }
    case 'expired':
      return { status: 'failed', progress, step: 'Failed', error: 'This model has expired on the cloud service.' }
    case 'cancelled':
      return { status: 'failed', progress, step: 'Failed', error: 'The cloud job was cancelled.' }
    default:
      return {
        status: 'failed',
        progress,
        step: 'Failed',
        error: (t.error_code && FRIENDLY[t.error_code]) || 'The cloud service could not build this model. Try another photo or use local mode.',
      }
  }
}
