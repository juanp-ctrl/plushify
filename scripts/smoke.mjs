// End-to-end smoke test against the running dev server (npm run dev).
// Usage: node scripts/smoke.mjs [stage]   stage = m1 (default) | m2 | ...
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'https://localhost:5173'
const stage = process.argv[2] ?? 'm1'
// Persistent profile so the AI models are only downloaded once across runs
const context = await chromium.launchPersistentContext(process.env.PW_PROFILE ?? '/tmp/snap3d-pw-profile', {
  channel: process.env.PW_CHANNEL ?? 'chrome',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-webgpu'],
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
})
const browser = context
// Headless Chrome can crash on real downloads, so capture <a download> blobs in-page instead
await context.addInitScript(() => {
  const click = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('blob:')) {
      window.__downloads = [...(window.__downloads ?? []), { name: this.download, href: this.href }]
      return
    }
    return click.call(this)
  }
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('crash', () => console.log('💥 PAGE CRASHED (renderer process died)'))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const step = (s) => console.log(`• ${s}`)
const t0 = Date.now()

await page.goto(BASE)
step('home loaded')

// Camera flow with Chrome's fake camera
await page.getByRole('button', { name: 'Take a photo' }).click()
await page.getByRole('button', { name: 'Take photo' }).waitFor({ timeout: 15000 })
step('camera preview ready')
await page.getByRole('button', { name: 'Close camera' }).click()

// Upload flow
await page.locator('input[type=file]').setInputFiles(`test-assets/${process.env.IMG ?? 'cup.jpg'}`)
await page.getByText('Looking good?').waitFor({ timeout: 180000 })
step(`cutout ready after ${((Date.now() - t0) / 1000).toFixed(1)}s`)
await page.screenshot({ path: '.scratch/m1-review.png' })

if (stage !== 'm1') {
  await page.getByRole('button', { name: 'Continue' }).click()
  const t1 = Date.now()
  await page.getByTestId('viewer-canvas').waitFor({ timeout: 180000 })
  await page.waitForTimeout(2500)
  step(`3D model shown after ${((Date.now() - t1) / 1000).toFixed(1)}s`)
  await page.screenshot({ path: `.scratch/${stage}-${process.env.IMG ?? 'cup'}-viewer.png` })
  // Orbit to a 3/4 side view to check the model has volume
  await page.evaluate(() => {
    const { camera, controls } = window.__r3f.get()
    const t = controls.target
    const d = camera.position.distanceTo(t)
    camera.position.set(t.x + d * 0.75, t.y + d * 0.2, t.z + d * 0.62)
    controls.update()
  })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `.scratch/${stage}-${process.env.IMG ?? 'cup'}-side.png` })
}

if (stage === 'm3') {
  await checkAnimations('local mesh')
  for (const glb of ['Duck.glb', 'Fox.glb']) {
    const b64 = (await import('node:fs')).readFileSync(`test-assets/${glb}`).toString('base64')
    await page.evaluate(async (data) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      await window.__loadGlb(URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' })))
    }, b64)
    await page.waitForTimeout(1200)
    await checkAnimations(glb)
  }
}

if (stage === 'm5') {
  const fs = await import('node:fs')
  const { validateBytes } = (await import('gltf-validator')).default
  await page.waitForTimeout(2500) // auto-save to gallery happens after the intro
  await page.getByRole('button', { name: 'Save & share' }).click()

  // 1) GLB download + validation + reload
  await page.getByRole('button', { name: /Download .glb/ }).click()
  await page.waitForFunction(() => window.__downloads?.length > 0)
  const b64 = await page.evaluate(async () => {
    const d = window.__downloads.at(-1)
    const buf = new Uint8Array(await (await fetch(d.href)).arrayBuffer())
    let s = ''
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return btoa(s)
  })
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'))
  fs.writeFileSync('.scratch/m5-export.glb', bytes)
  const report = await validateBytes(bytes)
  const nErr = report.issues.numErrors
  console.log(`  ${nErr === 0 ? '✓' : '✗'} GLB exported (${(bytes.length / 1024).toFixed(0)} KB), validator errors: ${nErr}, warnings: ${report.issues.numWarnings}`)
  if (nErr) errors.push('exported GLB has validation errors: ' + JSON.stringify(report.issues.messages.slice(0, 3)))

  // 2) Video
  await page.getByRole('button', { name: /Record 5s/ }).click()
  await page.getByTestId('recorded-video').waitFor({ timeout: 20000 })
  const vid = await page.evaluate(async () => {
    const v = document.querySelector('[data-testid=recorded-video]')
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })))
    const blob = await (await fetch(v.src)).blob()
    return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, type: blob.type, size: blob.size }
  })
  const vidOk = vid.size > 10000 && vid.w > 0
  console.log(`  ${vidOk ? '✓' : '✗'} video recorded: ${vid.type} ${vid.w}x${vid.h} ${(vid.size / 1024).toFixed(0)} KB duration=${vid.duration}`)
  if (!vidOk) errors.push('video recording failed')
  await page.getByRole('button', { name: '← Back' }).click()

  // 3) Share link opens on another page
  await page.getByRole('button', { name: /Copy share link/ }).click()
  const link = await page.getByLabel('Share link').inputValue({ timeout: 15000 })
  const other = await context.newPage()
  await other.goto(link)
  const sharedOk = await other.getByTestId('viewer-canvas').waitFor({ timeout: 20000 }).then(() => true, () => false)
  console.log(`  ${sharedOk ? '✓' : '✗'} share link opens the model: ${link}`)
  if (!sharedOk) errors.push('share link did not open')
  await other.close()
  await page.getByRole('button', { name: 'Close' }).click()

  // 4) Gallery persists after reload and re-opens
  await page.reload()
  const galleryBtn = page.getByRole('button', { name: /Gallery \(\d+\)/ })
  await galleryBtn.waitFor({ timeout: 10000 })
  console.log(`  ✓ home shows ${await galleryBtn.innerText()}`)
  await galleryBtn.click()
  await page.getByRole('button', { name: /Open creation/ }).first().click()
  const reopened = await page.getByTestId('viewer-canvas').waitFor({ timeout: 20000 }).then(() => true, () => false)
  console.log(`  ${reopened ? '✓' : '✗'} gallery item re-opens in the viewer`)
  if (!reopened) errors.push('gallery reopen failed')
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '.scratch/m5-reopened.png' })
}

/** Clicks every animation chip and asserts the model actually moves. */
async function checkAnimations(label) {
  const chips = await page.locator('section button[aria-pressed]').allInnerTexts()
  for (const text of chips) {
    const name = text.split('\n').pop().trim()
    await page.locator('section button[aria-pressed]', { hasText: name }).first().click()
    await page.waitForTimeout(1300) // let the pop-in / transitions settle
    const sample = () =>
      page.evaluate(() => {
        const scene = window.__r3f.get().scene
        const pivot = scene.getObjectByName('animation-pivot')
        const frags = scene.getObjectByName('fragments')
        let fragSig = 0
        frags?.children.forEach((c) => (fragSig += c.position.x + c.position.y * 3))
        let skin = 0
        scene.traverse((o) => { if (o.isBone) skin += o.quaternion.x + o.quaternion.y })
        return [...pivot.matrixWorld.elements, fragSig, skin].map((v) => v.toFixed(4)).join(',')
      })
    const a = await sample()
    await page.waitForTimeout(400)
    const b = await sample()
    const moving = a !== b
    const ok = name === 'Still' ? true : moving
    console.log(`  ${ok ? '✓' : '✗'} [${label}] ${name}${moving ? '' : ' (not moving)'}`)
    if (!ok) errors.push(`${label}: ${name} does not animate`)
    await page.screenshot({ path: `.scratch/m3-${label.replace(/\W/g, '')}-${name}.png` })
  }
  // Random button changes the selection
  const before = await page.locator('section button[aria-pressed=true]').innerText()
  await page.getByRole('button', { name: /Random/ }).click()
  const after = await page.locator('section button[aria-pressed=true]').innerText()
  console.log(`  ${before !== after ? '✓' : '✗'} [${label}] Random → ${after.split('\n').pop()}`)
  if (before === after) errors.push(`${label}: Random did not change animation`)
}

console.log(errors.length ? `✗ page errors:\n  ${errors.join('\n  ')}` : '✓ no page errors')
await browser.close()
process.exit(errors.length ? 1 : 0)
