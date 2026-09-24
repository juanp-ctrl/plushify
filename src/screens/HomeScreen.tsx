import { Button } from '../ui/Button.tsx'
import { UploadButton } from '../camera/UploadButton.tsx'
import { useApp } from '../store.ts'
import { useEffect, useState } from 'react'
import { countCreations } from '../gallery/db.ts'
import { BRAND } from '../brand.ts'

export function HomeScreen() {
  const go = useApp((s) => s.go)
  const [count, setCount] = useState(0)
  useEffect(() => {
    countCreations().then(setCount, () => {})
  }, [])
  return (
    <main className="safe-top safe-bottom mx-auto flex h-full max-w-md flex-col px-6">
      <header className="flex items-center gap-2 pt-2">
        <img src="/icon.svg" alt="" className="h-8 w-8" />
        <span className="text-lg font-bold tracking-tight">{BRAND.name}</span>
        {count > 0 && (
          <button onClick={() => go('gallery')} className="ml-auto rounded-full bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200">
            🖼️ Gallery ({count})
          </button>
        )}
      </header>
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 text-7xl" aria-hidden>📸 → 🧸</div>
        <h1 className="text-3xl font-bold tracking-tight">{BRAND.tagline}</h1>
        <p className="mt-3 text-zinc-400">{BRAND.description}</p>
      </section>
      <div className="flex flex-col gap-3 pb-4">
        <Button onClick={() => go('camera')}>Take a photo</Button>
        <UploadButton />
      </div>
    </main>
  )
}
