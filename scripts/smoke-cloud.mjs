// Cloud-mode smoke test. Start the API with MODEL_PROVIDER=mock (see README), then:
//   node scripts/smoke-cloud.mjs [ok|error|nokey]
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'https://localhost:5173'
const scenario = process.argv[2] ?? 'ok'
const context = await chromium.launchPersistentContext(process.env.PW_PROFILE ?? '/tmp/snap3d-pw-profile', {
  channel: process.env.PW_CHANNEL ?? 'chrome',
  ignoreHTTPSErrors: true,
  viewport: { width: 390, height: 844 },
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(BASE)
await page.locator('input[type=file]').setInputFiles('test-assets/cup.jpg')
await page.getByText('Looking good?').waitFor({ timeout: 120000 })
const cloud = page.getByRole('radio', { name: /Cloud/ })

if (scenario === 'nokey') {
  const disabled = await cloud.isDisabled()
  console.log(`${disabled ? '✓' : '✗'} cloud option disabled without a key`)
  if (!disabled) errors.push('cloud should be disabled')
} else {
  await cloud.click()
  await page.getByRole('button', { name: 'Continue' }).click()
  const steps = new Set()
  const t0 = Date.now()
  while (Date.now() - t0 < 60000) {
    const label = await page.locator('[role=progressbar]').getAttribute('aria-label', { timeout: 200 }).catch(() => null)
    if (label) steps.add(label)
    if (await page.getByTestId('viewer-canvas').isVisible().catch(() => false)) break
    if (await page.getByRole('alert').isVisible().catch(() => false)) break
    await page.waitForTimeout(300)
  }
  console.log('  progress steps seen:', [...steps].join(' → '))
  if (scenario === 'ok') {
    const ok = await page.getByTestId('viewer-canvas').isVisible()
    console.log(`${ok ? '✓' : '✗'} cloud model shown after ${((Date.now() - t0) / 1000).toFixed(1)}s`)
    if (!ok) errors.push('viewer not shown')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: '.scratch/m4-cloud.png' })
  } else {
    const alert = await page.getByRole('alert').innerText()
    console.log(`✓ error shown: ${alert.split('\n')[0]}`)
    await page.getByRole('button', { name: 'Try local mode' }).click()
    await page.getByTestId('viewer-canvas').waitFor({ timeout: 60000 })
    console.log('✓ fallback to local mode works')
  }
}
console.log(errors.length ? `✗ ${errors.join('; ')}` : '✓ no page errors')
await context.close()
process.exit(errors.length ? 1 : 0)
