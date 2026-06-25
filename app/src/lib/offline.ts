// Offline-first report queue backed by IndexedDB (no dependencies).
//
// Reports are ALWAYS written here first, then flushed to the API in order when
// connectivity returns. A report is never lost or blocked on the network — this
// is a hard requirement of the crisis spec (Section 6, Resilience).

const DB_NAME = 'ayudaterremoto'
const STORE = 'pending_reports'
const DB_VERSION = 1

export interface QueuedReport {
  localId: string
  payload: unknown
  queuedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function enqueueReport(payload: unknown): Promise<QueuedReport> {
  const item: QueuedReport = {
    localId: crypto.randomUUID(),
    payload,
    queuedAt: new Date().toISOString(),
  }
  await tx('readwrite', (s) => s.add(item))
  return item
}

export async function getQueuedReports(): Promise<QueuedReport[]> {
  return tx<QueuedReport[]>('readonly', (s) => s.getAll())
}

export async function removeQueuedReport(localId: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(localId))
}

export async function queuedCount(): Promise<number> {
  return tx<number>('readonly', (s) => s.count())
}

/**
 * Flush the queue in insertion order. `submit` returns true on success (item is
 * removed) or false on a recoverable failure (item kept, flush stops so order is
 * preserved). Returns the number of reports successfully synced.
 */
export async function syncReports(submit: (payload: unknown) => Promise<boolean>): Promise<number> {
  const items = (await getQueuedReports()).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  let synced = 0
  for (const item of items) {
    const ok = await submit(item.payload)
    if (!ok) break // stop on first failure to preserve ordering
    await removeQueuedReport(item.localId)
    synced++
  }
  return synced
}
