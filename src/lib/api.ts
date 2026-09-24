/** Thin client for the Plushify backend. The browser never talks to 3D providers directly. */

export interface ServerConfig {
  cloudAvailable: boolean
  provider: string | null
  rigging: boolean
}

export interface JobInfo {
  status: 'queued' | 'running' | 'success' | 'failed'
  progress: number
  step: string
  error?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e
    throw new ApiError("Can't reach the server. Check your connection.", 0)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? `Server error (${res.status})`, res.status)
  }
  return res.json() as Promise<T>
}

export async function getConfig(): Promise<ServerConfig> {
  try {
    return await request<ServerConfig>('/api/config')
  } catch {
    return { cloudAvailable: false, provider: null, rigging: false } // offline → local mode
  }
}

export function createJob(image: Blob, signal?: AbortSignal) {
  const form = new FormData()
  form.append('image', image, 'object.png')
  return request<{ jobId: string }>('/api/jobs', { method: 'POST', body: form, signal })
}

export const getJob = (id: string, signal?: AbortSignal) => request<JobInfo>(`/api/jobs/${encodeURIComponent(id)}`, { signal })

export const startRig = (id: string, signal?: AbortSignal) =>
  request<{ jobId: string }>(`/api/jobs/${encodeURIComponent(id)}/rig`, { method: 'POST', signal })

/** Downloads a finished model, reporting progress (0–1) when the size is known. */
export async function downloadModel(id: string, onProgress: (v: number) => void, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/model`, { signal })
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(body?.error ?? 'Could not download the model.', res.status)
  }
  const total = Number(res.headers.get('Content-Length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (total) onProgress(loaded / total)
  }
  return new Blob(chunks, { type: 'model/gltf-binary' })
}

/**
 * Polls a job until it finishes. Tolerates a few consecutive network blips,
 * and gives up after `timeoutMs`.
 */
export async function pollJob(
  id: string,
  { onUpdate, signal, intervalMs = 1500, timeoutMs = 240_000 }: { onUpdate: (j: JobInfo) => void; signal: AbortSignal; intervalMs?: number; timeoutMs?: number },
): Promise<JobInfo> {
  const deadline = Date.now() + timeoutMs
  let failures = 0
  while (Date.now() < deadline) {
    signal.throwIfAborted()
    try {
      const job = await getJob(id, signal)
      failures = 0
      onUpdate(job)
      if (job.status === 'success') return job
      if (job.status === 'failed') throw new ApiError(job.error ?? 'The cloud job failed.', 500)
    } catch (e) {
      if ((e as Error)?.name === 'AbortError' || (e instanceof ApiError && e.status !== 0)) throw e
      if (++failures >= 4) throw e
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new ApiError('The cloud service is taking too long. Try again later or use local mode.', 504)
}
