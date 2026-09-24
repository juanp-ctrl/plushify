import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { GenerationMode } from '../generation/types.ts'

export interface Creation {
  id: string
  createdAt: number
  mode: GenerationMode
  thumbnail: Blob
  glb: Blob
}

/**
 * Stored shape. Bytes are kept as ArrayBuffers, not Blobs: Safari/iOS has long-standing bugs
 * where Blobs read back from IndexedDB can't be read ("NotReadableError"), so the gallery
 * would show a count but never open.
 */
interface StoredCreation {
  id: string
  createdAt: number
  mode: GenerationMode
  thumbnail: ArrayBuffer
  thumbnailType: string
  glb: ArrayBuffer
}

interface Snap3dDB extends DBSchema {
  creations: { key: string; value: StoredCreation; indexes: { byDate: number } }
}

let dbPromise: Promise<IDBPDatabase<Snap3dDB>> | undefined

function db() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('This browser does not support saving creations.'))
  dbPromise ??= openDB<Snap3dDB>('snap3d', 2, {
    async upgrade(d, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        d.createObjectStore('creations', { keyPath: 'id' }).createIndex('byDate', 'createdAt')
        return
      }
      if (oldVersion < 2) {
        // v1 stored Blobs. Drop them: converting would need async Blob reads, which
        // aren't allowed inside a versionchange transaction (and are what fails on Safari).
        await tx.objectStore('creations').clear()
      }
    },
  })
  dbPromise.catch(() => (dbPromise = undefined))
  return dbPromise
}

const toStored = async (c: Creation): Promise<StoredCreation> => ({
  id: c.id,
  createdAt: c.createdAt,
  mode: c.mode,
  thumbnail: await c.thumbnail.arrayBuffer(),
  thumbnailType: c.thumbnail.type || 'image/jpeg',
  glb: await c.glb.arrayBuffer(),
})

const fromStored = (s: StoredCreation): Creation => ({
  id: s.id,
  createdAt: s.createdAt,
  mode: s.mode,
  thumbnail: new Blob([s.thumbnail], { type: s.thumbnailType }),
  glb: new Blob([s.glb], { type: 'model/gltf-binary' }),
})

export async function saveCreation(c: Creation): Promise<void> {
  const stored = await toStored(c) // read the Blobs before opening the transaction
  try {
    await (await db()).put('creations', stored)
  } catch (e) {
    if ((e as DOMException)?.name === 'QuotaExceededError') throw new Error('Storage is full. Delete some creations from the gallery.')
    throw e
  }
}

export async function listCreations(): Promise<Creation[]> {
  return (await (await db()).getAllFromIndex('creations', 'byDate')).reverse().map(fromStored)
}

export async function deleteCreation(id: string): Promise<void> {
  await (await db()).delete('creations', id)
}

export async function countCreations(): Promise<number> {
  return (await db()).count('creations')
}
