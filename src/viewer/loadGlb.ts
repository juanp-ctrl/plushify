import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GeneratedModel, GenerationMode } from '../generation/types.ts'

/** Parses GLB bytes into a renderable model (keeps the bytes for export). */
export async function loadGlb(glb: Blob, mode: GenerationMode = 'cloud'): Promise<GeneratedModel> {
  const buffer = await glb.arrayBuffer()
  try {
    const gltf = await new GLTFLoader().parseAsync(buffer, '')
    return { object: gltf.scene, animations: gltf.animations, glb, mode }
  } catch (e) {
    throw new Error(`The 3D file could not be read${e instanceof Error ? `: ${e.message}` : ''}`)
  }
}
