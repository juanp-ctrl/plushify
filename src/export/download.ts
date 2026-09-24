export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const timestampName = (prefix: string, ext: string) =>
  `${prefix}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`
