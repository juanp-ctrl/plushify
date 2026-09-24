# Plushify 📸 → 🧸

Turn anything into a plushie. Take a photo of any object (a mug, a toy, a shoe, a plant, a pet). Plushify removes the background, builds a soft, rounded 3D plushie and plays it in an interactive scene with fun animations. You can then save it, record a video, or share a link.

> The brand lives in `src/brand.ts` (name, tagline), `index.html`, the PWA manifest in `vite.config.ts` and `public/icon.svg` (run `node scripts/make-icons.mjs` after changing the icon). Internal identifiers (folder, IndexedDB name `snap3d`) are intentionally unchanged, so existing galleries keep working.

- **Local mode (free, no key):** everything runs in the browser. It removes the background (RMBG-1.4), estimates depth (Depth Anything v2), then builds a closed mesh textured with your photo. It works offline once the models have been downloaded.
- **Cloud mode (high quality):** the backend sends the cutout to [Tripo](https://developers.tripo3d.ai) and gets back a textured GLB. For people and animals, it can also add a skeleton with walk, wave and jump animations.

Stack: Vite + React + TypeScript + Tailwind, three.js via @react-three/fiber and drei, transformers.js, and a small Hono server.

---

## Quick start

```bash
npm install
cp .env.example .env        # optional — without a key the app runs in local mode
npm run dev                 # starts the frontend (https://localhost:5173) + API (:8787)
```

The terminal prints a **QR code** and the LAN URL so you can open the app on your phone.

| Script | What it does |
| --- | --- |
| `npm run dev` | Frontend + backend with hot reload (HTTPS, reachable on your LAN) |
| `npm run dev:mock` | Same, but cloud mode uses a fake provider (no key or credits needed) |
| `npm run dev:tunnel` | Public HTTPS URL through Cloudflare Tunnel (requires `cloudflared`) |
| `npm run setup:https` | Creates a trusted certificate with mkcert (recommended for phones) |
| `npm run build` | Type-checks (`tsc -b`) and builds the PWA into `dist/` |
| `npm start` | Serves `dist/` and the API from one Node process (port 8787) |
| `npm test` | Unit tests (vitest) |
| `node scripts/smoke.mjs m5` | End-to-end browser test against a running `npm run dev` |

## Environment variables (`.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `MODEL_PROVIDER` | `tripo` | Cloud provider: `tripo` or `mock` |
| `TRIPO_API_KEY` | — | Key from [platform.tripo3d.ai](https://platform.tripo3d.ai) (starts with `tsk_`). If empty, cloud mode is disabled |
| `TRIPO_MODEL` | `v3.1-20260211` | Tripo geometry model version |
| `PORT` | `8787` | Backend port (Vite proxies `/api` to it) |
| `JOB_TIMEOUT_MS` | `180000` | Give up on a cloud job after this long |
| `MOCK_DURATION_MS` / `MOCK_FAIL` / `MOCK_GLB_PATH` | | Mock provider settings. `MOCK_FAIL=error\|timeout\|create` simulates failures |
| `SHARE_DIR` | `server/data/shares` | Where shared GLBs are stored |

Tripo pricing and free credits change over time. Check the [pricing page](https://developers.tripo3d.ai/en/pricing). Keys are only read by the server. The browser only talks to `/api/*`, and `npm run build` output contains no key.

## 📱 Testing on your phone

The camera only works over **HTTPS**, so the dev server always uses HTTPS and listens on your network.

1. Connect your computer and phone to the **same Wi-Fi**.
2. Run `npm run dev` and scan the QR code (or type the `https://<your-ip>:5173` URL). If macOS asks whether to allow incoming connections for `node`, click **Allow**.
3. Pick a certificate option:

**Option A — quick (self-signed).** This is used automatically when there's no `certs/` folder. The phone shows a warning once:
- Android Chrome: *Advanced → Proceed*.
- iPhone Safari: *Show Details → visit this website*.

**Option B — recommended (trusted, no warnings).**
```bash
npm run setup:https      # installs mkcert (Homebrew), creates certs/cert.pem + key.pem for localhost and your IP
```
Then install the mkcert root CA on the phone. The script prints its path (`$(mkcert -CAROOT)/rootCA.pem`).
- **iPhone:** AirDrop or email `rootCA.pem` to yourself and open it. Then go to *Settings → General → VPN & Device Management* and install the profile. Finally, go to *Settings → General → About → Certificate Trust Settings* and enable full trust for the mkcert certificate.
- **Android:** copy the file to the phone. Then go to *Settings → Security → Encryption & credentials → Install a certificate → CA certificate*.

Restart `npm run dev`; the terminal will say "Using mkcert certificate". If your IP changes, run `npm run setup:https` again.

**Option C — network blocks device-to-device traffic** (for example, on a university or office Wi-Fi):
```bash
brew install cloudflared
npm run dev             # in one terminal
npm run dev:tunnel      # in another — open the printed https://….trycloudflare.com URL on your phone
```

The first local-mode run downloads about 70 MB of AI models (the progress bar says so). After that, they're cached and the app works offline. You can install it to your home screen: *Share → Add to Home Screen* on iOS, or *Install app* on Android.

## How it works

```
photo ─► downscale (≤1024px) ─► background removal (RMBG-1.4, Web Worker)
                                           │
               ┌───────────────────────────┴──────────────────────────┐
         Local mode                                             Cloud mode
  depth (Depth Anything v2)                         POST /api/jobs ─► server ─► Tripo
  ─► displaced grid + domed back                    poll /api/jobs/:id (progress)
     + stitched side walls (buildMesh.ts)           GET /api/jobs/:id/model (GLB proxy)
               └───────────────────────────┬──────────────────────────┘
                              viewer (auto-center + auto-scale)
                     procedural animations · export · IndexedDB gallery
```

```
src/
  camera/         getUserMedia hook (rear camera, switch, error handling), upload button
  segmentation/   RMBG-1.4 (runs in the worker) + cutout/crop composition
  generation/     ModelGenerator interface, LocalGenerator (depth → mesh), CloudGenerator (backend)
  ml/             the single Web Worker that hosts all in-browser models
  viewer/         R3F canvas, studio lighting/HDRI, contact shadow, normalisation, GLB loader
  animations/     procedural animation registry, jelly shader patch, fragments, controls, rigging
  export/         GLB export, canvas video recording, share links
  gallery/        IndexedDB storage + gallery screen
  screens/, ui/   app screens and shared UI
server/
  index.ts        Hono API: /api/config, /api/jobs, /api/share
  providers/      ProviderAdapter interface, tripo.ts, mock.ts, registry
```

### Animations
All animations are procedural, so they work on **any** mesh: Spin, Bounce (squash and stretch that keeps the volume), Float, Jelly (a vertex-shader wobble injected with `onBeforeCompile`), Dance, Explode and reassemble (the mesh is split into chunks on a 3D grid), and a Pop-in intro. Use the sliders to control speed and intensity, and 🎲 to pick something at random. Rigged cloud models also list their skeletal clips (🦴).

To add an animation, add an entry to `src/animations/registry.ts`:
```ts
{ id: 'wiggle', label: 'Wiggle', emoji: '🪱', update({ pivot }, t, { speed, intensity }) {
    pivot.rotation.z = Math.sin(t * speed * 10) * 0.2 * intensity
} }
```

## Adding a new 3D provider

1. Create `server/providers/myprovider.ts` implementing `ProviderAdapter` (`server/providers/types.ts`):
   ```ts
   export class MyProvider implements ProviderAdapter {
     readonly name = 'myprovider'
     readonly canRig = false
     async createJob(image: ImageInput): Promise<string> { /* upload + start job, return its id */ }
     async getJob(id: string): Promise<JobInfo> { /* map to { status, progress 0–100, step, error? } */ }
     async fetchModel(id: string): Promise<Response> { /* fetch the finished GLB */ }
   }
   ```
   - Throw `ProviderError(message)` for errors that are safe to show to users.
   - Use `fetchWithRetry` (`server/http.ts`) for timeouts and backoff.
   - Job ids must match `/^(task|rig)_[\w-]+$/` (add a prefix if the provider's ids don't).
   - If the provider only returns OBJ/FBX, convert it to GLB, or pick the provider's GLB output option.
2. Register it in `server/providers/index.ts`:
   ```ts
   myprovider: () => (process.env.MY_API_KEY ? new MyProvider(process.env.MY_API_KEY) : null),
   ```
3. Set `MODEL_PROVIDER=myprovider` and `MY_API_KEY=…` in `.env`, then add them to `.env.example`.

The frontend doesn't change. It only knows the backend's `/api/jobs` contract.

## Notes
- **Model licences:** the RMBG-1.4 weights are licensed for non-commercial use only. For commercial use, swap `MODEL_ID` in `src/segmentation/rmbg.ts` for a model with a permissive licence (for example `Xenova/modnet`, which is tuned for portraits, or BiRefNet). The studio HDRI is CC0 from Poly Haven.
- **Share links** store the GLB on the server (`server/data/shares`). They work for anyone who can reach the server: devices on the same Wi-Fi when running locally, or anyone once it's deployed.
- **The plush look:** local mode "inflates" the silhouette. Thickness grows with the square root of the distance to the outline, so thin parts stay thin and round parts get puffy. It also uses a matte fabric material with a soft sheen. Use the **Thickness** slider to make a plushie flatter or puffier. Cloud mode gives full 360° geometry.
