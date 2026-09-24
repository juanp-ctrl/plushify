import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import type { GeneratedModel } from '../generation/types.ts'

/** Returns GLB bytes: the provider's original file if we have it, otherwise exports the scene graph. */
export async function getGlb(model: GeneratedModel): Promise<Blob> {
  if (model.glb) return model.glb
  const result = await new GLTFExporter().parseAsync(model.object, {
    binary: true,
    onlyVisible: false, // the model may be hidden while the explode animation plays
    animations: model.animations ?? [],
  })
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
}
