import { useRef, useState, type ReactNode } from 'react'
import { Button } from '../ui/Button.tsx'
import { loadAndDownscale } from '../lib/image.ts'
import { useApp } from '../store.ts'

export function UploadButton({ variant = 'secondary', className, children }: { variant?: 'primary' | 'secondary' | 'ghost'; className?: string; children?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setPhoto, go } = useApp()

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      setPhoto(await loadAndDownscale(file))
      go('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Button variant={variant} className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Loading…' : (children ?? 'Upload image')}
      </Button>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </>
  )
}
