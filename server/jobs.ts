import type { JobInfo } from './providers/types.ts'

const TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 180_000)
const MAX_AGE_MS = 6 * 60 * 60 * 1000

/**
 * Jobs created through this server. Only these ids can be polled/downloaded,
 * so the proxy can't be used to access arbitrary provider tasks.
 */
const jobs = new Map<string, { createdAt: number }>()

export function trackJob(id: string) {
  jobs.set(id, { createdAt: Date.now() })
  for (const [k, v] of jobs) if (Date.now() - v.createdAt > MAX_AGE_MS) jobs.delete(k)
}

export const isKnownJob = (id: string) => jobs.has(id)

/** Marks unfinished jobs as failed once they exceed JOB_TIMEOUT_MS. */
export function applyTimeout(id: string, info: JobInfo): JobInfo {
  const job = jobs.get(id)
  if (!job || info.status === 'success' || info.status === 'failed') return info
  if (Date.now() - job.createdAt > TIMEOUT_MS) {
    return { ...info, status: 'failed', error: 'The cloud service is taking too long. Try again later or use local mode.' }
  }
  return info
}
