import { clamp01, easeInOutCubic, easeOutCubic } from './easing.ts'
import { setExplode } from './fragments.ts'
import type { AnimContext, ProceduralAnimation } from './types.ts'

const TAU = Math.PI * 2

/** Scales the pivot around the model's centre while keeping its base on the ground. */
function squash(ctx: AnimContext, sy: number, lift = 0) {
  const sxz = 1 / Math.sqrt(Math.max(sy, 0.05)) // keep volume
  ctx.pivot.scale.set(sxz, sy, sxz)
  ctx.pivot.position.y = (ctx.height / 2) * sy + lift
}

export const animations: ProceduralAnimation[] = [
  {
    id: 'spin',
    label: 'Spin',
    emoji: '🔄',
    update({ pivot }, t, { speed }) {
      pivot.rotation.y = t * speed * 1.4
    },
  },
  {
    id: 'bounce',
    label: 'Bounce',
    emoji: '🏀',
    update(ctx, t, { speed, intensity }) {
      const p = (t * speed * 1.1) % 1 // 0 → take-off … 1 → landing
      const air = Math.sin(Math.PI * p)
      const contact = Math.exp(-((Math.min(p, 1 - p) * 9) ** 2)) // peaks when touching the ground
      const velocity = Math.abs(Math.cos(Math.PI * p))
      const sy = 1 - 0.35 * intensity * contact + 0.18 * intensity * velocity * (1 - contact)
      squash(ctx, sy, air * ctx.height * 0.55 * intensity)
      ctx.pivot.rotation.y = Math.sin(t * speed * 0.7) * 0.4
    },
  },
  {
    id: 'float',
    label: 'Float',
    emoji: '🎈',
    update({ pivot, height }, t, { speed, intensity }) {
      const w = t * speed * TAU * 0.45
      pivot.position.y = height / 2 + height * (0.12 + 0.1 * Math.sin(w)) * intensity
      pivot.rotation.z = Math.sin(w * 0.8) * 0.08 * intensity
      pivot.rotation.x = Math.cos(w * 0.6) * 0.06 * intensity
      pivot.rotation.y = Math.sin(w * 0.3) * 0.5
    },
  },
  {
    id: 'jelly',
    label: 'Jelly',
    emoji: '🍮',
    update(ctx, t, { speed, intensity }) {
      ctx.jelly.set(t * speed, intensity)
      squash(ctx, 1 + 0.08 * intensity * Math.sin(t * speed * 9))
    },
    stop(ctx) {
      ctx.jelly.set(0, 0)
    },
  },
  {
    id: 'dance',
    label: 'Dance',
    emoji: '💃',
    update(ctx, t, { speed, intensity }) {
      const beat = t * speed * 2 // ~120 bpm
      const hop = Math.abs(Math.sin(beat * Math.PI))
      const pulse = Math.max(0, Math.cos(beat * TAU)) ** 4
      squash(ctx, 1 - 0.12 * intensity * pulse, hop * ctx.height * 0.12 * intensity)
      ctx.pivot.rotation.y = Math.sin(beat * Math.PI * 0.5) * 0.7 * intensity
      ctx.pivot.rotation.z = Math.sin(beat * Math.PI) * 0.2 * intensity
      ctx.pivot.rotation.x = Math.sin(beat * Math.PI * 0.5 + 1) * 0.08 * intensity
    },
  },
  {
    id: 'explode',
    label: 'Explode',
    emoji: '💥',
    start(ctx) {
      const f = ctx.fragments()
      ctx.model.parent?.add(f.group)
      ctx.model.visible = false
    },
    update(ctx, t, { speed, intensity }) {
      const p = ((t * speed) / 3.2) % 1
      // hold → burst out → hang → reassemble → hold
      const amount =
        p < 0.15 ? 0 : p < 0.4 ? easeOutCubic((p - 0.15) / 0.25) : p < 0.55 ? 1 : p < 0.9 ? 1 - easeInOutCubic((p - 0.55) / 0.35) : 0
      setExplode(ctx.fragments(), amount * Math.max(0.2, intensity))
      ctx.pivot.rotation.y = t * speed * 0.4
    },
    stop(ctx) {
      const f = ctx.fragments()
      setExplode(f, 0)
      f.group.removeFromParent()
      ctx.model.visible = true
    },
  },
  {
    id: 'none',
    label: 'Still',
    emoji: '⏸️',
    update() {},
  },
]

export const animationById = (id: string) => animations.find((a) => a.id === id) ?? animations[0]

/** The one-off "pop-in" intro, layered on top of whatever animation is playing. */
export const POP_IN_DURATION = 0.9
export function applyPopIn(ctx: AnimContext, elapsed: number) {
  if (elapsed >= POP_IN_DURATION) return
  const x = clamp01(elapsed / POP_IN_DURATION)
  const s = x <= 0 ? 0 : 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2 // overshoot then settle
  ctx.pivot.scale.multiplyScalar(Math.max(0.001, s))
  ctx.pivot.rotation.y += (1 - easeOutCubic(x)) * Math.PI
}
