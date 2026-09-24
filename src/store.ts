import { create } from 'zustand'
import type { LoadedImage } from './lib/image.ts'
import type { Cutout } from './segmentation/removeBackground.ts'
import type { GeneratedModel, GenerationMode } from './generation/types.ts'
import { getConfig, type ServerConfig } from './lib/api.ts'

export type Screen = 'home' | 'camera' | 'review' | 'generating' | 'viewer' | 'gallery' | 'shared'

interface AppState {
  screen: Screen
  photo: LoadedImage | null
  cutout: Cutout | null
  model: GeneratedModel | null
  mode: GenerationMode
  bgColor: string
  config: ServerConfig
  loadConfig: () => Promise<void>
  go: (screen: Screen) => void
  setPhoto: (photo: LoadedImage) => void
  setCutout: (cutout: Cutout | null) => void
  setModel: (model: GeneratedModel | null) => void
  setMode: (mode: GenerationMode) => void
  setBgColor: (color: string) => void
  reset: () => void
}

const revoke = (x: { url: string } | null) => x && URL.revokeObjectURL(x.url)

export const useApp = create<AppState>((set, get) => ({
  screen: new URLSearchParams(location.search).has('model') ? 'shared' : 'home',
  photo: null,
  cutout: null,
  model: null,
  mode: 'local',
  bgColor: '#2a1f33',
  config: { cloudAvailable: false, provider: null, rigging: false },
  loadConfig: async () => {
    const config = await getConfig()
    set({ config, mode: config.cloudAvailable ? 'cloud' : 'local' })
  },
  go: (screen) => set({ screen }),
  setPhoto: (photo) => {
    revoke(get().photo)
    revoke(get().cutout)
    set({ photo, cutout: null, model: null })
  },
  setCutout: (cutout) => {
    revoke(get().cutout)
    set({ cutout })
  },
  setModel: (model) => set({ model }),
  setMode: (mode) => set({ mode }),
  setBgColor: (bgColor) => set({ bgColor }),
  reset: () => {
    revoke(get().photo)
    revoke(get().cutout)
    set({ screen: 'home', photo: null, cutout: null, model: null })
  },
}))
