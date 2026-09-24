import { create } from 'zustand'
import { animations } from './registry.ts'

interface AnimState {
  /** Procedural animation id, or `clip:<name>` for a skeletal clip. */
  current: string
  speed: number
  intensity: number
  /** Bumped to replay the pop-in intro. */
  introKey: number
  setCurrent: (id: string) => void
  setSpeed: (v: number) => void
  setIntensity: (v: number) => void
  randomize: (clips?: string[]) => void
  replayIntro: () => void
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export const useAnimStore = create<AnimState>((set, get) => ({
  current: 'spin',
  speed: 1,
  intensity: 1,
  introKey: 0,
  setCurrent: (current) => set({ current }),
  setSpeed: (speed) => set({ speed }),
  setIntensity: (intensity) => set({ intensity }),
  randomize: (clips = []) => {
    const options = [...animations.filter((a) => a.id !== 'none').map((a) => a.id), ...clips.map((c) => `clip:${c}`)].filter(
      (id) => id !== get().current,
    )
    set({
      current: pick(options),
      speed: Math.round((0.6 + Math.random() * 1.2) * 10) / 10,
      intensity: Math.round((0.6 + Math.random() * 0.8) * 10) / 10,
    })
  },
  replayIntro: () => set((s) => ({ introKey: s.introKey + 1 })),
}))
