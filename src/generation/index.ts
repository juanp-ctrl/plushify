import { LocalGenerator } from './local/LocalGenerator.ts'
import { CloudGenerator } from './cloud/CloudGenerator.ts'
import type { GenerationMode, ModelGenerator } from './types.ts'

/** Add new client-side generators here. Cloud providers are added on the server (see README). */
export function getGenerator(mode: GenerationMode): ModelGenerator {
  return mode === 'cloud' ? new CloudGenerator() : new LocalGenerator()
}
