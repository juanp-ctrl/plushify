import type { Group, Object3D } from 'three'
import type { JellyController } from './jellyMaterial.ts'
import type { Fragments } from './fragments.ts'

export interface AnimParams {
  /** 1 = normal speed */
  speed: number
  /** 0 = none, 1 = normal, 2 = extreme */
  intensity: number
}

export interface AnimContext {
  /** Group whose origin is the model's centre; animations drive its transform. */
  pivot: Group
  /** Model height in scene units (after normalisation). */
  height: number
  /** The model itself (inside the normalised wrapper). */
  model: Object3D
  jelly: JellyController
  /** Lazily built fragment set for the explode effect. */
  fragments: () => Fragments
}

export interface ProceduralAnimation {
  id: string
  label: string
  emoji: string
  /** Called every frame after the pivot has been reset to its rest pose. `t` is seconds since start. */
  update(ctx: AnimContext, t: number, p: AnimParams): void
  start?(ctx: AnimContext): void
  stop?(ctx: AnimContext): void
}
