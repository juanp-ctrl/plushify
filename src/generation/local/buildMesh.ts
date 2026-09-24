/**
 * Turns a depth map + alpha mask into a closed, textured "2.5D" mesh:
 * a displaced front surface, a smooth domed back, and side walls stitching the two
 * along the silhouette. Pure data in / data out so it can be unit-tested without WebGL.
 */

export interface MeshInput {
  /** Relative depth, 0–255, larger = closer. */
  depth: ArrayLike<number>
  /** Alpha mask, 0–255. Same size as depth. */
  mask: ArrayLike<number>
  width: number
  height: number
  /** Grid cells along the long side. */
  segments?: number
  /** Front relief depth (from the depth map), as a fraction of the long side. */
  relief?: number
  /**
   * How much the silhouette is "inflated" into a rounded volume. Thickness grows with the
   * square root of the distance to the outline, so thin parts (petals, handles) stay thin.
   */
  inflate?: number
}

export interface MeshData {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint32Array
}

const INSIDE = 128

export function buildMesh({ depth, mask, width, height, segments = 160, relief = 0.12, inflate = 0.16 }: MeshInput): MeshData {
  const long = Math.max(width, height)
  const cols = Math.max(2, Math.round((segments * width) / long))
  const rows = Math.max(2, Math.round((segments * height) / long))
  const vw = cols + 1
  const vh = rows + 1
  const n = vw * vh
  const sizeX = width / long
  const sizeY = height / long

  // Sample mask + depth per grid vertex (box-filtered to reduce noise)
  const inside = new Uint8Array(n)
  const d = new Float32Array(n)
  const rx = Math.max(1, Math.floor(width / cols / 2))
  const ry = Math.max(1, Math.floor(height / rows / 2))
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const px = Math.min(width - 1, Math.round((i / cols) * (width - 1)))
      const py = Math.min(height - 1, Math.round((j / rows) * (height - 1)))
      const k = j * vw + i
      inside[k] = mask[py * width + px] >= INSIDE ? 1 : 0
      let sum = 0
      let cnt = 0
      for (let y = Math.max(0, py - ry); y <= Math.min(height - 1, py + ry); y++) {
        for (let x = Math.max(0, px - rx); x <= Math.min(width - 1, px + rx); x++) {
          if (mask[y * width + x] >= INSIDE) {
            sum += depth[y * width + x]
            cnt++
          }
        }
      }
      d[k] = cnt ? sum / cnt : 0
    }
  }

  // Robust depth normalisation (2nd–98th percentile of the object's pixels)
  const vals: number[] = []
  for (let k = 0; k < n; k++) if (inside[k]) vals.push(d[k])
  if (vals.length < 3) throw new Error('The object is too small to build a 3D model.')
  vals.sort((a, b) => a - b)
  const lo = vals[Math.floor(vals.length * 0.02)]
  const hi = vals[Math.floor(vals.length * 0.98)]
  const range = Math.max(1e-3, hi - lo)

  // Distance to the silhouette (chamfer distance transform) → rounded "inflation"
  const dist = smoothInside(distanceTransform(inside, vw, vh), inside, vw, vh, 3)
  const cellSize = 1 / Math.max(cols, rows) // grid cell size as a fraction of the long side

  const positions = new Float32Array(n * 2 * 3)
  const uvs = new Float32Array(n * 2 * 2)
  const rim = 0.012
  for (let j = 0; j < vh; j++) {
    for (let i = 0; i < vw; i++) {
      const k = j * vw + i
      const u = i / cols
      const v = j / rows
      const x = (u - 0.5) * sizeX
      const y = (0.5 - v) * sizeY
      const dn = Math.min(1, Math.max(0, (d[k] - lo) / range))
      const edgeDist = dist[k] * cellSize // absolute distance to the outline
      const bulge = inflate * Math.sqrt(edgeDist)
      const fade = smoothstep(0, 0.04, edgeDist) // front and back meet at the outline
      const zFront = rim + bulge * 0.7 + relief * dn * fade
      const zBack = -(rim + bulge)
      positions.set([x, y, zFront], k * 3)
      positions.set([x, y, zBack], (n + k) * 3)
      uvs.set([u, 1 - v], k * 2)
      uvs.set([u, 1 - v], (n + k) * 2)
    }
  }

  const indices: number[] = []
  const edgeCount = new Map<number, number>()
  const edgeKey = (a: number, b: number) => (a < b ? a * n + b : b * n + a)
  const addTri = (a: number, b: number, c: number) => {
    if (!inside[a] || !inside[b] || !inside[c]) return
    indices.push(a, b, c) // front (counter-clockwise seen from +z)
    indices.push(n + a, n + c, n + b) // back, reversed winding
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(p, q)
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1)
    }
  }
  const directed: [number, number][] = []
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * vw + i
      const b = a + 1
      const c = a + vw
      const e = c + 1
      addTri(a, c, b)
      addTri(b, c, e)
    }
  }
  // Collect boundary edges with their front-face orientation, then add wall quads
  for (let t = 0; t < indices.length; t += 6) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]]
    for (const [p, q] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      if (edgeCount.get(edgeKey(p, q)) === 1) directed.push([p, q])
    }
  }
  for (const [p, q] of directed) {
    indices.push(q, p, n + p, q, n + p, n + q)
  }
  smoothSilhouette(directed, positions, uvs, n, sizeX, sizeY)

  return { positions, uvs, indices: new Uint32Array(indices) }
}

/**
 * The grid silhouette is a staircase; relax boundary vertices along the outline
 * (Laplacian smoothing on x/y) and move their UVs with them.
 */
function smoothSilhouette(edges: [number, number][], positions: Float32Array, uvs: Float32Array, n: number, sizeX: number, sizeY: number, iterations = 4) {
  const neighbors = new Map<number, number[]>()
  for (const [p, q] of edges) {
    if (!neighbors.has(p)) neighbors.set(p, [])
    if (!neighbors.has(q)) neighbors.set(q, [])
    neighbors.get(p)!.push(q)
    neighbors.get(q)!.push(p)
  }
  const verts = [...neighbors.keys()]
  const next = new Float32Array(verts.length * 2)
  for (let it = 0; it < iterations; it++) {
    verts.forEach((v, idx) => {
      const nb = neighbors.get(v)!
      let x = 0
      let y = 0
      for (const w of nb) {
        x += positions[w * 3]
        y += positions[w * 3 + 1]
      }
      next[idx * 2] = positions[v * 3] * 0.5 + (x / nb.length) * 0.5
      next[idx * 2 + 1] = positions[v * 3 + 1] * 0.5 + (y / nb.length) * 0.5
    })
    verts.forEach((v, idx) => {
      for (const k of [v, n + v]) {
        positions[k * 3] = next[idx * 2]
        positions[k * 3 + 1] = next[idx * 2 + 1]
        uvs[k * 2] = next[idx * 2] / sizeX + 0.5
        uvs[k * 2 + 1] = next[idx * 2 + 1] / sizeY + 0.5
      }
    })
  }
}

/** Box-blurs a field, only averaging over inside vertices (removes distance-transform creases). */
function smoothInside(field: Float32Array, inside: Uint8Array, w: number, h: number, passes: number): Float32Array {
  let src = field
  for (let p = 0; p < passes; p++) {
    const dst = new Float32Array(src.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x
        if (!inside[k]) continue
        let sum = 0
        let cnt = 0
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            const kk = yy * w + xx
            sum += inside[kk] ? src[kk] : 0
            cnt++
          }
        }
        dst[k] = sum / cnt
      }
    }
    src = dst
  }
  return src
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function distanceTransform(inside: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9
  const dist = new Float32Array(w * h)
  for (let k = 0; k < dist.length; k++) dist[k] = inside[k] ? INF : 0
  const D = 1
  const DD = Math.SQRT2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (!dist[k]) continue
      let m = dist[k]
      if (x > 0) m = Math.min(m, dist[k - 1] + D)
      if (y > 0) m = Math.min(m, dist[k - w] + D)
      if (x > 0 && y > 0) m = Math.min(m, dist[k - w - 1] + DD)
      if (x < w - 1 && y > 0) m = Math.min(m, dist[k - w + 1] + DD)
      // Pixels on the image border count as edge
      if (x === 0 || y === 0) m = Math.min(m, 1)
      dist[k] = m
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x
      if (!dist[k]) continue
      let m = dist[k]
      if (x < w - 1) m = Math.min(m, dist[k + 1] + D)
      if (y < h - 1) m = Math.min(m, dist[k + w] + D)
      if (x < w - 1 && y < h - 1) m = Math.min(m, dist[k + w + 1] + DD)
      if (x > 0 && y < h - 1) m = Math.min(m, dist[k + w - 1] + DD)
      if (x === w - 1 || y === h - 1) m = Math.min(m, 1)
      dist[k] = m
    }
  }
  return dist
}
