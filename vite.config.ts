import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import os from 'node:os'
import qrcode from 'qrcode-terminal'

const API_PORT = Number(process.env.PORT ?? 8787)
const certFile = 'certs/cert.pem'
const keyFile = 'certs/key.pem'
const hasMkcert = fs.existsSync(certFile) && fs.existsSync(keyFile)

/** Best guess at the Wi-Fi/Ethernet address a phone on the same network can reach. */
function lanIp(): string | undefined {
  const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, nets]) =>
    (nets ?? [])
      .filter((n) => n.family === 'IPv4' && !n.internal && !n.address.startsWith('127.'))
      .map((n) => ({ name, address: n.address })),
  )
  const isPrivate = (a: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)
  const score = (c: { name: string; address: string }) =>
    (/^(en|eth|wl)/.test(c.name) ? 2 : 0) + (isPrivate(c.address) ? 1 : 0)
  return candidates.sort((a, b) => score(b) - score(a))[0]?.address
}

/** Prints the LAN URL + a QR code so the app can be opened on a phone. */
function phoneQr(): Plugin {
  return {
    name: 'snap3d-phone-qr',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const ip = lanIp()
        if (!ip) return
        const url = `https://${ip}:${server.config.server.port}`
        setTimeout(() => {
          console.log(`\n  📱 Open on your phone (same Wi-Fi): ${url}`)
          console.log(hasMkcert ? '  🔒 Using mkcert certificate' : '  ⚠️  Self-signed cert: accept the warning once (or run npm run setup:https)')
          qrcode.generate(url, { small: true })
        }, 300)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(hasMkcert ? [] : [basicSsl()]),
    phoneQr(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Plushify — turn anything into a plushie',
        short_name: 'Plushify',
        description: 'Turn a photo of anything into an animated 3D plushie.',
        theme_color: '#1a1320',
        background_color: '#1a1320',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,hdr}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // The ~27 MB ONNX runtime is cached on first use instead of at install time
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'wasm', expiration: { maxEntries: 5 } },
          },
          {
            // ONNX runtime WASM used by transformers.js (the AI models themselves are cached by transformers.js)
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: { cacheName: 'onnx-runtime', expiration: { maxEntries: 20 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/.scratch/**', '**/server/**', '**/test-assets/**', '**/certs/**'] },
    https: hasMkcert ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) } : undefined,
    proxy: { '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true } },
  },
  preview: {
    host: true,
    proxy: { '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true } },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
    // Pre-bundle everything used by lazily loaded screens, otherwise Vite reloads the page
    // the first time you reach them in dev ("new dependencies optimized")
    entries: ['index.html', 'src/**/*.tsx'],
    include: ['three', '@react-three/fiber', '@react-three/drei', 'zustand', 'three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/exporters/GLTFExporter.js', 'idb'],
  },
  worker: { format: 'es' },
})
