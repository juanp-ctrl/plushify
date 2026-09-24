// Renders public/icon.svg into the PNG icons needed by the PWA manifest / iOS.
import { chromium } from 'playwright'
import fs from 'node:fs'
const svg = fs.readFileSync('public/icon.svg', 'utf8')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0], ['maskable-512.png', 512, 0.12]]) {
  await page.setViewportSize({ width: size, height: size })
  const inner = Math.round(size * (1 - pad * 2))
  await page.setContent(`<body style="margin:0;background:#1a1320;display:grid;place-items:center;height:${size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body>`)
  await page.screenshot({ path: `public/icons/${name}` })
}
await browser.close()
