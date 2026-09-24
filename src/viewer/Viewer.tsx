import { Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { useApp } from '../store.ts'
import { viewerCanvas } from './canvasRef.ts'
import { isLowMemoryDevice } from '../ml/device.ts'

export function Viewer({ children }: { children: ReactNode }) {
  const bgColor = useApp((s) => s.bgColor)
  return (
    <div className="h-full w-full touch-none" data-testid="viewer-canvas">
      <Canvas
        shadows
        dpr={[1, isLowMemoryDevice() ? 1.5 : 2]}
        camera={{ position: [0, 1.3, 3.4], fov: 40, near: 0.05, far: 100 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        fallback={<p className="grid h-full place-items-center p-6 text-center text-zinc-300">Your browser or device doesn't support 3D graphics (WebGL). Try an up-to-date Chrome or Safari.</p>}
        onCreated={(state) => {
          viewerCanvas.current = state.gl.domElement
          // Exposed for the smoke tests / debugging in dev only
          if (import.meta.env.DEV) (window as unknown as { __r3f: unknown }).__r3f = state
        }}
      >
        <color attach="background" args={[bgColor]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} castShadow />
        <directionalLight position={[-4, 3, -2]} intensity={0.4} />
        <Suspense fallback={null}>
          <Environment files="/hdri/studio.hdr" environmentIntensity={0.8} />
        </Suspense>
        {children}
        <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={6} blur={2.4} far={3} resolution={512} />
        <OrbitControls makeDefault minDistance={1} enableDamping maxPolarAngle={Math.PI * 0.95} />
      </Canvas>
    </div>
  )
}
