import type { Object3D } from 'three'
import type { Cutout } from '../segmentation/removeBackground.ts'
import type { ProgressInfo } from '../lib/workerRpc.ts'

export type GenerationMode = 'local' | 'cloud'

export interface GenerationInput {
  cutout: Cutout
}

export interface GeneratedModel {
  /** Ready-to-render scene graph. */
  object: Object3D
  mode: GenerationMode
  /** Original GLB bytes when the provider returned one (cloud mode). */
  glb?: Blob
  /** Backend job id (cloud mode), used for rigging. */
  jobId?: string
  /** IndexedDB gallery id once saved. */
  galleryId?: string
  savedAt?: 'saved'
  /** Skeletal animation clips, if the model was rigged. */
  animations?: import('three').AnimationClip[]
}

/** Common interface for every way of producing a 3D model from a cutout photo. */
export interface ModelGenerator {
  readonly mode: GenerationMode
  generate(input: GenerationInput, onProgress: (p: ProgressInfo) => void, signal: AbortSignal): Promise<GeneratedModel>
}
