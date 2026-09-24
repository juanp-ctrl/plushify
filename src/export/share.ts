import { ApiError } from '../lib/api.ts'

/** Uploads a GLB to the server and returns a link that opens it in the viewer. */
export async function createShareLink(glb: Blob): Promise<string> {
  const res = await fetch('/api/share', { method: 'POST', body: glb, headers: { 'Content-Type': 'model/gltf-binary' } }).catch(() => {
    throw new ApiError("Can't reach the server to create a link.", 0)
  })
  const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null
  if (!res.ok || !body?.id) throw new ApiError(body?.error ?? 'Could not create a share link.', res.status)
  return `${location.origin}/?model=${body.id}`
}

export async function fetchSharedModel(id: string): Promise<Blob> {
  const res = await fetch(`/api/share/${encodeURIComponent(id)}`)
  if (!res.ok) throw new ApiError(res.status === 404 ? 'This shared model no longer exists.' : 'Could not load the shared model.', res.status)
  return res.blob()
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Native share sheet (mobile). Returns false if unsupported. */
export async function nativeShare(data: { title: string; text?: string; url?: string; files?: File[] }): Promise<boolean> {
  if (!navigator.share) return false
  if (data.files && !navigator.canShare?.({ files: data.files })) delete data.files
  try {
    await navigator.share(data)
    return true
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return true // user closed the sheet
    return false
  }
}
