import { lazy, Suspense, useEffect } from 'react'
import { useApp } from './store.ts'
import { HomeScreen } from './screens/HomeScreen.tsx'
import { CameraScreen } from './screens/CameraScreen.tsx'
import { ReviewScreen } from './screens/ReviewScreen.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary.tsx'
const GeneratingScreen = lazy(() => import('./screens/GeneratingScreen.tsx').then((m) => ({ default: m.GeneratingScreen })))
const ViewerScreen = lazy(() => import('./screens/ViewerScreen.tsx').then((m) => ({ default: m.ViewerScreen })))
const GalleryScreen = lazy(() => import('./gallery/GalleryScreen.tsx').then((m) => ({ default: m.GalleryScreen })))
const SharedModelLoader = lazy(() => import('./screens/SharedModelLoader.tsx').then((m) => ({ default: m.SharedModelLoader })))

if (import.meta.env.DEV) {
  // Test hook: load any GLB straight into the viewer (used by scripts/smoke.mjs)
  Object.assign(window, {
    __loadGlb: async (url: string) => {
      const { loadGlb } = await import('./viewer/loadGlb.ts')
      const model = await loadGlb(await (await fetch(url)).blob())
      useApp.setState({ model, screen: 'viewer' })
    },
  })
}

export default function App() {
  const screen = useApp((s) => s.screen)
  const loadConfig = useApp((s) => s.loadConfig)
  const reset = useApp((s) => s.reset)
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  return (
    <ErrorBoundary onReset={reset}>
      <Suspense fallback={<p className="grid h-full place-items-center text-zinc-400">Loading…</p>}>{renderScreen(screen)}</Suspense>
    </ErrorBoundary>
  )
}

function renderScreen(screen: ReturnType<typeof useApp.getState>['screen']) {
  switch (screen) {
    case 'camera':
      return <CameraScreen />
    case 'review':
      return <ReviewScreen />
    case 'generating':
      return <GeneratingScreen />
    case 'viewer':
      return <ViewerScreen />
    case 'gallery':
      return <GalleryScreen />
    case 'shared':
      return <SharedModelLoader />
    default:
      return <HomeScreen />
  }
}
