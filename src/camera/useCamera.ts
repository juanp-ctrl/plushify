import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraErrorKind = 'insecure' | 'unsupported' | 'denied' | 'no-camera' | 'in-use' | 'unknown'

export interface CameraError {
  kind: CameraErrorKind
  message: string
}

export type Facing = 'environment' | 'user'

const MESSAGES: Record<CameraErrorKind, string> = {
  insecure: 'The camera needs a secure (HTTPS) connection. Open the https:// address shown in the terminal.',
  unsupported: "This browser can't access the camera. You can still upload a photo.",
  denied: 'Camera permission was denied. Allow camera access in your browser settings, or upload a photo instead.',
  'no-camera': 'No camera was found on this device. You can upload a photo instead.',
  'in-use': 'The camera is being used by another app. Close it and try again.',
  unknown: 'The camera could not be started.',
}

function toCameraError(err: unknown): CameraError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  const kind: CameraErrorKind =
    name === 'NotAllowedError' || name === 'SecurityError'
      ? 'denied'
      : name === 'NotFoundError' || name === 'OverconstrainedError'
        ? 'no-camera'
        : name === 'NotReadableError' || name === 'AbortError'
          ? 'in-use'
          : 'unknown'
  return { kind, message: MESSAGES[kind] }
}

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [facing, setFacing] = useState<Facing>('environment')
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting')
  const [error, setError] = useState<CameraError | null>(null)
  const [canSwitch, setCanSwitch] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    const fail = (e: CameraError) => {
      setError(e)
      setStatus('error')
    }

    async function start() {
      setStatus('starting')
      setError(null)
      if (!window.isSecureContext) return fail({ kind: 'insecure', message: MESSAGES.insecure })
      if (!navigator.mediaDevices?.getUserMedia) return fail({ kind: 'unsupported', message: MESSAGES.unsupported })
      stop()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => {})
        }
        setStatus('ready')
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (err) {
        if (!cancelled) fail(toCameraError(err))
      }
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [facing, stop, videoRef])

  const switchCamera = useCallback(() => setFacing((f) => (f === 'environment' ? 'user' : 'environment')), [])

  /** Grabs the current video frame as a JPEG blob. */
  const capture = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current
    if (!video || !video.videoWidth) throw new Error('The camera is not ready yet.')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    if (facing === 'user') {
      // Match the mirrored preview
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Capture failed'))), 'image/jpeg', 0.92),
    )
  }, [facing, videoRef])

  return { status, error, facing, canSwitch, switchCamera, capture, stop }
}
