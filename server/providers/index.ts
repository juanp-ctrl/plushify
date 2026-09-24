import { MockProvider } from './mock.ts'
import { TripoProvider } from './tripo.ts'
import type { ProviderAdapter } from './types.ts'

type Factory = () => ProviderAdapter | null

/**
 * Register new providers here, keyed by the MODEL_PROVIDER env var.
 * Return null when the provider isn't configured (e.g. missing key) → the app falls back to local mode.
 */
const registry: Record<string, Factory> = {
  tripo: () => (process.env.TRIPO_API_KEY ? new TripoProvider(process.env.TRIPO_API_KEY) : null),
  mock: () => new MockProvider(),
}

let cached: ProviderAdapter | null | undefined

export function getProvider(): ProviderAdapter | null {
  if (cached !== undefined) return cached
  const key = (process.env.MODEL_PROVIDER ?? 'tripo').toLowerCase()
  if (!registry[key]) console.warn(`Unknown MODEL_PROVIDER "${key}". Available: ${Object.keys(registry).join(', ')}`)
  cached = registry[key]?.() ?? null
  return cached
}
