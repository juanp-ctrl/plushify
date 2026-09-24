import { useEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { MathUtils, Vector3, type Group, type PerspectiveCamera } from 'three'
import type { OrbitControls } from 'three-stdlib'
import type { GeneratedModel } from '../generation/types.ts'
import { computeNormalization, TARGET_SIZE } from './normalize.ts'

/** Normalises the model, frames the camera on it, and places it under an animation pivot. */
export function ModelStage({ model, children }: { model: GeneratedModel; children?: (pivot: React.RefObject<Group | null>, height: number) => React.ReactNode }) {
  const pivot = useRef<Group>(null)
  const { scale, position, height } = useMemo(() => computeNormalization(model.object), [model])

  useEffect(() => {
    model.object.traverse((o) => {
      o.castShadow = true
      o.receiveShadow = true
    })
  }, [model])

  useFitCamera(height)

  return (
    <>
      <group ref={pivot} position={[0, height / 2, 0]} name="animation-pivot">
        <group position={[0, -height / 2, 0]}>
          <group name="normalized" scale={scale} position={position}>
            <primitive object={model.object} />
          </group>
        </group>
      </group>
      {children?.(pivot, height)}
    </>
  )
}

/** Places the camera so a TARGET_SIZE model fits the viewport (portrait or landscape). */
function useFitCamera(height: number) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const controls = useThree((s) => s.controls) as OrbitControls | null
  const aspect = useThree((s) => s.size.width / s.size.height)

  useEffect(() => {
    const radius = TARGET_SIZE * 0.62 // leaves room for animations (bounce, explode)
    const vFov = MathUtils.degToRad(camera.fov)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const dist = radius / Math.sin(Math.min(vFov, hFov) / 2)
    const target = new Vector3(0, height / 2, 0)
    const dir = new Vector3(0, 0.25, 1).normalize()
    camera.position.copy(target).addScaledVector(dir, dist)
    camera.lookAt(target)
    if (controls) {
      controls.target.copy(target)
      controls.maxDistance = dist * 3
      controls.update()
    }
  }, [camera, controls, aspect, height])
}
