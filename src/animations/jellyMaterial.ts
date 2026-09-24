import { Box3, Vector3, type Material, type Mesh, type Object3D } from 'three'

export interface JellyController {
  set(time: number, intensity: number): void
  dispose(): void
}

const TAG = 'snap3dJelly'

/**
 * Injects a wobbly "jelly" deformation into every material of a model via onBeforeCompile.
 * Works on any mesh (no rig needed). With intensity 0 the shader is a no-op.
 */
export function attachJelly(root: Object3D): JellyController {
  const uniforms = { uTime: { value: 0 }, uJelly: { value: 0 } }
  const patched: { mesh: Mesh; original: Material | Material[] }[] = []

  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || mesh.userData[TAG]) return
    mesh.userData[TAG] = true
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox ?? new Box3()
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const meshUniforms = { ...uniforms, uCenter: { value: center }, uSize: { value: Math.max(size.x, size.y, size.z, 1e-6) }, uMinY: { value: box.min.y } }

    const patch = (m: Material) => {
      const mat = m.clone()
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, meshUniforms)
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
uniform float uTime; uniform float uJelly; uniform vec3 uCenter; uniform float uSize; uniform float uMinY;`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
if (uJelly > 0.0) {
  vec3 rel = (transformed - uCenter) / uSize;
  float h = clamp((transformed.y - uMinY) / uSize, 0.0, 1.0); // 0 at the base, 1 at the top
  float wave = sin(uTime * 9.0 - h * 7.0);
  float wobble = sin(uTime * 6.0 + rel.x * 5.0 + rel.z * 4.0);
  rel.xz *= 1.0 + uJelly * (0.10 * wave + 0.04 * wobble) * h;
  rel.y *= 1.0 - uJelly * 0.06 * sin(uTime * 9.0 + 1.2);
  rel.x += uJelly * 0.06 * h * h * sin(uTime * 5.0);
  transformed = uCenter + rel * uSize;
}`,
          )
      }
      mat.customProgramCacheKey = () => `${TAG}-${m.uuid}`
      return mat
    }
    patched.push({ mesh, original: mesh.material })
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(patch) : patch(mesh.material)
  })

  return {
    set(time, intensity) {
      uniforms.uTime.value = time
      uniforms.uJelly.value = intensity
    },
    dispose() {
      for (const { mesh, original } of patched) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        mats.forEach((m) => m.dispose())
        mesh.material = original
        delete mesh.userData[TAG]
      }
    },
  }
}
