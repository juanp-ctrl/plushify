import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const DIR = path.resolve(process.env.SHARE_DIR ?? 'server/data/shares')
const ID = /^[A-Za-z0-9_-]{16}$/

/** Stores a shared GLB on disk and returns its id. */
export async function saveShare(data: Uint8Array): Promise<string> {
  // glTF binary files start with the ASCII magic "glTF"
  if (data.length < 12 || Buffer.from(data.subarray(0, 4)).toString('ascii') !== 'glTF') throw new Error('not-glb')
  await fs.mkdir(DIR, { recursive: true })
  const id = crypto.randomBytes(12).toString('base64url')
  await fs.writeFile(path.join(DIR, `${id}.glb`), data)
  return id
}

export async function readShare(id: string): Promise<Buffer | null> {
  if (!ID.test(id)) return null
  return fs.readFile(path.join(DIR, `${id}.glb`)).catch(() => null)
}
