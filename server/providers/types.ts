export type JobStatus = 'queued' | 'running' | 'success' | 'failed'

export interface JobInfo {
  status: JobStatus
  /** 0–100 */
  progress: number
  /** Human-readable step, e.g. "Building 3D model…" */
  step: string
  /** User-friendly error, present when status is "failed". */
  error?: string
}

export interface ImageInput {
  data: Uint8Array<ArrayBuffer>
  mimeType: string
  filename: string
}

/**
 * A cloud image-to-3D provider. Implementations run only on the server,
 * so API keys never reach the browser.
 */
export interface ProviderAdapter {
  readonly name: string
  /** Whether rig() is supported. */
  readonly canRig: boolean
  /** Starts an async generation job and returns its id. */
  createJob(image: ImageInput): Promise<string>
  getJob(jobId: string): Promise<JobInfo>
  /** Returns the finished GLB. Only valid once status is "success". */
  fetchModel(jobId: string): Promise<Response>
  /** Optional: rigs + animates a finished model. Returns a new job id to poll. */
  rig?(jobId: string): Promise<string>
}

/** Error whose message is safe to show to end users. */
export class ProviderError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}
