/** fetch with a per-attempt timeout and exponential-backoff retries on transient failures. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 3, timeoutMs = 30_000, retryOn5xx = true }: { retries?: number; timeoutMs?: number; retryOn5xx?: boolean } = {},
): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1) + Math.random() * 250)
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      const transient = res.status === 429 || (retryOn5xx && res.status >= 500)
      if (!transient || attempt === retries) return res
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err // network error or timeout → retry
    }
  }
  throw lastError
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
