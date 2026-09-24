import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AnimationMixer, type AnimationAction, type Group } from 'three'
import type { GeneratedModel } from '../generation/types.ts'
import { attachJelly } from './jellyMaterial.ts'
import { buildFragments, type Fragments } from './fragments.ts'
import { animationById, applyPopIn } from './registry.ts'
import { useAnimStore } from './store.ts'
import type { AnimContext, ProceduralAnimation } from './types.ts'

/** Drives the pivot transform every frame from the selected animation. Lives inside the Canvas. */
export function AnimationDriver({ model, pivot, height }: { model: GeneratedModel; pivot: React.RefObject<Group | null>; height: number }) {
  const current = useAnimStore((s) => s.current)
  const introKey = useAnimStore((s) => s.introKey)
  const clock = useRef({ t: 0, intro: 0 })
  const active = useRef<ProceduralAnimation | null>(null)

  // Per-model helpers
  const jelly = useMemo(() => attachJelly(model.object), [model])
  useEffect(() => () => jelly.dispose(), [jelly])
  const fragmentsRef = useRef<Fragments | null>(null)
  useEffect(
    () => () => {
      fragmentsRef.current?.dispose()
      fragmentsRef.current = null
    },
    [model],
  )

  const mixer = useMemo(() => new AnimationMixer(model.object), [model])
  const clipAction = useRef<AnimationAction | null>(null)

  const ctx = useRef<AnimContext | null>(null)
  const getCtx = (): AnimContext | null => {
    if (!pivot.current) return null
    ctx.current ??= {
      pivot: pivot.current,
      height,
      model: model.object,
      jelly,
      fragments: () => (fragmentsRef.current ??= buildFragments(model.object)),
    }
    return ctx.current
  }
  useEffect(() => {
    ctx.current = null
  }, [model, height, jelly])

  // Switch animations
  useEffect(() => {
    const c = getCtx()
    active.current?.stop?.(c!)
    active.current = null
    clipAction.current?.fadeOut(0.3)
    clipAction.current = null
    clock.current.t = 0

    if (current.startsWith('clip:')) {
      const clip = model.animations?.find((a) => a.name === current.slice(5))
      if (clip) clipAction.current = mixer.clipAction(clip).reset().fadeIn(0.3).play()
    } else {
      const anim = animationById(current)
      if (c) anim.start?.(c)
      active.current = anim
    }
    return () => {
      const c2 = getCtx()
      if (c2) active.current?.stop?.(c2)
      active.current = null
    }
  }, [current, model, mixer])

  useEffect(() => {
    clock.current.intro = 0
  }, [introKey, model])

  useFrame((_, dt) => {
    const c = getCtx()
    if (!c) return
    const { speed, intensity } = useAnimStore.getState()
    const step = Math.min(dt, 0.1)
    clock.current.t += step
    clock.current.intro += step

    // Reset to rest pose, then apply the animation layers
    c.pivot.position.set(0, height / 2, 0)
    c.pivot.rotation.set(0, 0, 0)
    c.pivot.scale.set(1, 1, 1)
    active.current?.update(c, clock.current.t, { speed, intensity })
    mixer.timeScale = speed
    mixer.update(step)
    applyPopIn(c, clock.current.intro)
  })

  return null
}
