import { Box3, BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Quaternion, Vector3, type Material, type Object3D } from 'three'

export interface Fragment {
  mesh: Mesh
  /** Rest position (in the model's local space). */
  home: Vector3
  /** Direction + distance to fly out. */
  offset: Vector3
  axis: Vector3
  spin: number
}

export interface Fragments {
  group: Group
  pieces: Fragment[]
  dispose(): void
}

const tmpQ = new Quaternion()

/**
 * Splits any model into chunks by bucketing triangles on a 3D grid (by centroid).
 * The resulting group lives in the model's local space so it can be swapped in place.
 */
export function buildFragments(model: Object3D, cellsPerAxis = 4): Fragments {
  model.updateMatrixWorld(true)
  const toModel = new Matrix4().copy(model.matrixWorld).invert()
  const bounds = new Box3()
  type Source = { positions: Float32Array; uvs: Float32Array | null; normals: Float32Array | null; material: Material }
  const sources: Source[] = []

  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || !mesh.visible) return
    const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(
      new Matrix4().multiplyMatrices(toModel, mesh.matrixWorld),
    )
    geo.computeBoundingBox()
    bounds.union(geo.boundingBox!)
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    sources.push({
      positions: geo.getAttribute('position').array as Float32Array,
      uvs: (geo.getAttribute('uv')?.array as Float32Array) ?? null,
      normals: (geo.getAttribute('normal')?.array as Float32Array) ?? null,
      material,
    })
    geo.dispose()
  })

  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const cell = (v: number, min: number, len: number) => Math.min(cellsPerAxis - 1, Math.floor(((v - min) / Math.max(len, 1e-6)) * cellsPerAxis))

  const group = new Group()
  group.name = 'fragments'
  const pieces: Fragment[] = []
  const maxDim = Math.max(size.x, size.y, size.z)

  sources.forEach((src) => {
    const buckets = new Map<number, number[]>()
    const triCount = src.positions.length / 9
    for (let t = 0; t < triCount; t++) {
      const o = t * 9
      const cx = (src.positions[o] + src.positions[o + 3] + src.positions[o + 6]) / 3
      const cy = (src.positions[o + 1] + src.positions[o + 4] + src.positions[o + 7]) / 3
      const cz = (src.positions[o + 2] + src.positions[o + 5] + src.positions[o + 8]) / 3
      const key =
        cell(cx, bounds.min.x, size.x) + cellsPerAxis * (cell(cy, bounds.min.y, size.y) + cellsPerAxis * cell(cz, bounds.min.z, size.z))
      let list = buckets.get(key)
      if (!list) buckets.set(key, (list = []))
      list.push(t)
    }

    for (const tris of buckets.values()) {
      const pos = new Float32Array(tris.length * 9)
      const uv = src.uvs ? new Float32Array(tris.length * 6) : null
      const nor = src.normals ? new Float32Array(tris.length * 9) : null
      tris.forEach((t, i) => {
        pos.set(src.positions.subarray(t * 9, t * 9 + 9), i * 9)
        if (uv && src.uvs) uv.set(src.uvs.subarray(t * 6, t * 6 + 6), i * 6)
        if (nor && src.normals) nor.set(src.normals.subarray(t * 9, t * 9 + 9), i * 9)
      })
      const geo = new BufferGeometry()
      geo.setAttribute('position', new BufferAttribute(pos, 3))
      if (uv) geo.setAttribute('uv', new BufferAttribute(uv, 2))
      if (nor) geo.setAttribute('normal', new BufferAttribute(nor, 3))
      else geo.computeVertexNormals()
      geo.computeBoundingBox()
      const home = geo.boundingBox!.getCenter(new Vector3())
      geo.translate(-home.x, -home.y, -home.z)

      const mesh = new Mesh(geo, src.material)
      mesh.castShadow = true
      mesh.position.copy(home)
      group.add(mesh)

      const dir = home.clone().sub(center)
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0)
      dir.normalize().add(new Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(0.6)).normalize()
      pieces.push({
        mesh,
        home,
        offset: dir.multiplyScalar(maxDim * (0.22 + Math.random() * 0.22)),
        axis: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: (Math.random() - 0.5) * Math.PI * 3,
      })
    }
  })

  return {
    group,
    pieces,
    dispose() {
      pieces.forEach((p) => p.mesh.geometry.dispose())
    },
  }
}

/** Positions all fragments at `amount` (0 = assembled, 1 = fully exploded). */
export function setExplode(f: Fragments, amount: number) {
  for (const p of f.pieces) {
    p.mesh.position.copy(p.home).addScaledVector(p.offset, amount)
    p.mesh.quaternion.copy(tmpQ.setFromAxisAngle(p.axis, p.spin * amount))
  }
}
