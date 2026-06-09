// Abstraction over IndexedDB for storing PDF blobs and metadata.
// Lightweight wrapper around IndexedDB — minimal features required by the MVP.

const DB_NAME = 'reuso-pdfs-db'
const STORE_NAME = 'pdfs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const pdfService = {
  async savePdf(id: string, blob: Blob): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const item = {
        id,
        blob,
        size: blob.size,
        createdAt: new Date().toISOString()
      }
      const req = store.put(item as any)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async getPdf(id: string): Promise<Blob | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(id)
      req.onsuccess = () => {
        const result = req.result
        resolve(result ? (result.blob as Blob) : null)
      }
      req.onerror = () => reject(req.error)
    })
  },

  async deletePdf(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

export default pdfService
