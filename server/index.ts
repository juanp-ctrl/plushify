import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { bodyLimit } from 'hono/body-limit'
import { logger } from 'hono/logger'
import { getProvider } from './providers/index.ts'
import { ProviderError } from './providers/types.ts'
import { applyTimeout, isKnownJob, trackJob } from './jobs.ts'
import { readShare, saveShare } from './storage.ts'

const app = new Hono()
app.use('/api/*', logger())

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const JOB_ID = /^(task|rig)_[\w-]{1,100}$/

app.onError((err, c) => {
  if (err instanceof ProviderError) return c.json({ error: err.message }, err.status as 500)
  console.error(err)
  return c.json({ error: 'Something went wrong on the server.' }, 500)
})

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/config', (c) => {
  const provider = getProvider()
  return c.json({ cloudAvailable: provider !== null, provider: provider?.name ?? null, rigging: provider?.canRig ?? false, sharing: true })
})

/** Starts a cloud generation job from an uploaded (cut-out) image. */
app.post(
  '/api/jobs',
  bodyLimit({ maxSize: 8 * 1024 * 1024, onError: (c) => c.json({ error: 'The image is too large (max 8 MB).' }, 413) }),
  async (c) => {
    const provider = getProvider()
    if (!provider) return c.json({ error: 'Cloud mode is not configured on the server.' }, 503)
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('image')
    if (!(file instanceof File)) return c.json({ error: 'No image was uploaded.' }, 400)
    if (!IMAGE_TYPES.has(file.type)) return c.json({ error: 'Only PNG, JPEG or WebP images are supported.' }, 415)
    const jobId = await provider.createJob({ data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type, filename: file.name || 'object.png' })
    trackJob(jobId)
    return c.json({ jobId }, 201)
  },
)

app.get('/api/jobs/:id', async (c) => {
  const { id, provider } = requireJob(c.req.param('id'))
  return c.json(applyTimeout(id, await provider.getJob(id)))
})

app.get('/api/jobs/:id/model', async (c) => {
  const { id, provider } = requireJob(c.req.param('id'))
  const upstream = await provider.fetchModel(id)
  const headers = new Headers({ 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'private, max-age=3600' })
  const len = upstream.headers.get('Content-Length')
  if (len) headers.set('Content-Length', len)
  return new Response(upstream.body, { headers })
})

app.post('/api/jobs/:id/rig', async (c) => {
  const { id, provider } = requireJob(c.req.param('id'))
  if (!provider.rig) return c.json({ error: 'This provider does not support rigging.' }, 501)
  const rigId = await provider.rig(id)
  trackJob(rigId)
  return c.json({ jobId: rigId }, 201)
})

/** Share links: stores a GLB on the server so it can be opened from any device on the network. */
app.post(
  '/api/share',
  bodyLimit({ maxSize: 50 * 1024 * 1024, onError: (c) => c.json({ error: 'The model is too large to share (max 50 MB).' }, 413) }),
  async (c) => {
    const data = new Uint8Array(await c.req.arrayBuffer())
    try {
      return c.json({ id: await saveShare(data) }, 201)
    } catch (e) {
      if ((e as Error).message === 'not-glb') return c.json({ error: 'Only .glb files can be shared.' }, 415)
      throw e
    }
  },
)

app.get('/api/share/:id', async (c) => {
  const data = await readShare(c.req.param('id'))
  if (!data) return c.json({ error: 'Not found' }, 404)
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'model/gltf-binary', 'Cache-Control': 'public, max-age=31536000, immutable' } })
})

function requireJob(id: string) {
  const provider = getProvider()
  if (!provider) throw new ProviderError('Cloud mode is not configured on the server.', 503)
  if (!JOB_ID.test(id) || !isKnownJob(id)) throw new ProviderError('Unknown job. It may have expired — please generate the model again.', 404)
  return { id, provider }
}

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))
}

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port }, () => {
  const p = getProvider()
  console.log(`API listening on http://localhost:${port} (cloud provider: ${p ? p.name : 'none — local mode only'})`)
})
