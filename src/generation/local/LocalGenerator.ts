import { BufferAttribute, BufferGeometry, Color, Mesh, MeshPhysicalMaterial, SRGBColorSpace, TextureLoader } from 'three'
import { mlWorker } from '../../ml/client.ts'
import { buildMesh } from './buildMesh.ts'
import type { DepthResult } from './depth.ts'
import type { GeneratedModel, GenerationInput, ModelGenerator } from '../types.ts'
import type { ProgressInfo } from '../../lib/workerRpc.ts'

/** Fully in-browser generator: depth estimation → displaced, closed mesh → photo texture. */
export class LocalGenerator implements ModelGenerator {
  readonly mode = 'local' as const

  async generate({ cutout }: GenerationInput, onProgress: (p: ProgressInfo) => void, signal: AbortSignal): Promise<GeneratedModel> {
    const depth = await mlWorker().call<DepthResult>('depth', { blob: cutout.cropBlob }, { onProgress, signal })

    onProgress({ label: 'Stuffing it with fluff…', value: 0.7 })
    await nextFrame()
    const data = buildMesh({ depth: depth.data, mask: resizeMask(cutout, depth.width, depth.height), width: depth.width, height: depth.height })
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(data.uvs, 2))
    geometry.setIndex(new BufferAttribute(data.indices, 1))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()

    onProgress({ label: 'Sewing the fabric…', value: 0.9 })
    // Use the un-masked crop as texture so the silhouette has no dark fringe
    const url = URL.createObjectURL(cutout.cropBlob)
    try {
      const map = await new TextureLoader().loadAsync(url)
      map.colorSpace = SRGBColorSpace
      map.anisotropy = 4
      // Soft fabric look: matte base + sheen (the fuzzy glow velvet/plush gets at grazing angles)
      const material = new MeshPhysicalMaterial({ map, roughness: 0.8, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new Color('#fff4ee') })
      const mesh = new Mesh(geometry, material)
      mesh.name = 'Plushie'
      mesh.castShadow = true
      signal.throwIfAborted()
      return { object: mesh, mode: 'local' }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function resizeMask(cutout: GenerationInput['cutout'], w: number, h: number): Uint8Array {
  if (cutout.width === w && cutout.height === h) return cutout.mask
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(cutout.height - 1, Math.floor((y * cutout.height) / h))
    for (let x = 0; x < w; x++) {
      out[y * w + x] = cutout.mask[sy * cutout.width + Math.min(cutout.width - 1, Math.floor((x * cutout.width) / w))]
    }
  }
  return out
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
