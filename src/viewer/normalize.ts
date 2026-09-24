import { Box3, Vector3, type Object3D } from 'three'

export const TARGET_SIZE = 1.6

export interface Normalization {
  scale: number
  position: [number, number, number]
  /** Model height after scaling. */
  height: number
}

/**
 * Computes the transform that centres any model on the origin in x/z, rests it on y = 0
 * and makes its largest dimension TARGET_SIZE. Side-effect free (safe inside useMemo).
 */
export function computeNormalization(object: Object3D): Normalization {
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z, 1e-6)
  return {
    scale,
    position: [-center.x * scale, -box.min.y * scale, -center.z * scale],
    height: size.y * scale,
  }
}
