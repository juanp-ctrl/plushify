import { describe, expect, it } from 'vitest'
import { buildMesh } from './buildMesh.ts'

function disc(size: number) {
  const mask = new Uint8Array(size * size)
  const depth = new Uint8Array(size * size)
  const c = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - c, y - c) / c
      mask[y * size + x] = r < 0.8 ? 255 : 0
      depth[y * size + x] = Math.round(255 * Math.max(0, 1 - r))
    }
  }
  return { mask, depth, width: size, height: size }
}

describe('buildMesh', () => {
  it('produces a closed (watertight) mesh', () => {
    const { indices } = buildMesh({ ...disc(128), segments: 48 })
    expect(indices.length % 3).toBe(0)
    // Every undirected edge of a closed manifold mesh is shared by exactly 2 triangles
    const count = new Map<string, number>()
    for (let t = 0; t < indices.length; t += 3) {
      const tri = [indices[t], indices[t + 1], indices[t + 2]]
      for (let e = 0; e < 3; e++) {
        const a = tri[e]
        const b = tri[(e + 1) % 3]
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        count.set(key, (count.get(key) ?? 0) + 1)
      }
    }
    for (const v of count.values()) expect(v).toBe(2)
  })

  it('puts the front in +z and the back in -z', () => {
    const { positions } = buildMesh({ ...disc(64), segments: 32 })
    const n = positions.length / 6
    let front = 0
    let back = 0
    for (let k = 0; k < n; k++) {
      front = Math.max(front, positions[k * 3 + 2])
      back = Math.min(back, positions[(n + k) * 3 + 2])
    }
    expect(front).toBeGreaterThan(0.1)
    expect(back).toBeLessThan(-0.05)
  })

  it('keeps the aspect ratio of the image', () => {
    const w = 100
    const h = 50
    const { positions } = buildMesh({ depth: new Uint8Array(w * h).fill(100), mask: new Uint8Array(w * h).fill(255), width: w, height: h, segments: 20 })
    let maxX = 0
    let maxY = 0
    for (let k = 0; k < positions.length; k += 3) {
      maxX = Math.max(maxX, positions[k])
      maxY = Math.max(maxY, positions[k + 1])
    }
    expect(maxX / maxY).toBeCloseTo(2, 1)
  })

  it('keeps thin parts thin (thickness follows the local width, not the whole object)', () => {
    const thickness = ({ positions }: { positions: Float32Array }) => {
      let min = 0
      let max = 0
      for (let k = 2; k < positions.length; k += 3) {
        min = Math.min(min, positions[k])
        max = Math.max(max, positions[k])
      }
      return max - min
    }
    const size = 128
    const strip = new Uint8Array(size * size)
    for (let y = 0; y < size; y++) for (let x = 58; x < 70; x++) strip[y * size + x] = 255 // ~10% wide
    const flat = new Uint8Array(size * size).fill(128)
    const thin = thickness(buildMesh({ depth: flat, mask: strip, width: size, height: size, segments: 64 }))
    const fat = thickness(buildMesh({ ...disc(size), depth: flat, segments: 64 }))
    expect(thin).toBeLessThan(0.15) // was ~0.6 before the fix
    expect(fat).toBeGreaterThan(thin * 1.8)
  })

  it('throws on an empty mask', () => {
    expect(() => buildMesh({ depth: new Uint8Array(16), mask: new Uint8Array(16), width: 4, height: 4 })).toThrow()
  })
})
