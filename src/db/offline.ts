/**
 * db/offline.ts
 * IndexedDB shim that mirrors the Cloudflare D1 schema.
 * Used as the primary storage layer in the browser; D1 is the sync target.
 *
 * Object stores
 *  • sessions   — WorkSession records
 *  • breaks     — Break records (keyed by id, indexed by sessionId)
 *  • projects   — Project records
 *  • settings   — Single-row payroll settings (id = 1)
 *  • sync_queue — Mutations pending upload to D1
 */

const DB_NAME    = 'timeireland'
const DB_VERSION = 1

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncOperation = 'upsert' | 'delete'

export interface SyncQueueItem {
  id:        string          // random uuid
  store:     string          // object store name
  operation: SyncOperation
  payload:   Record<string, unknown>
  createdAt: string
}

// ─── Open / upgrade ───────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

export function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // sessions
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' })
        s.createIndex('startTime', 'startTime', { unique: false })
      }

      // breaks
      if (!db.objectStoreNames.contains('breaks')) {
        const b = db.createObjectStore('breaks', { keyPath: 'id' })
        b.createIndex('sessionId', 'sessionId', { unique: false })
      }

      // projects
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }

      // settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' })
      }

      // sync queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const q = db.createObjectStore('sync_queue', { keyPath: 'id' })
        q.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    req.onsuccess = (event) => {
      _db = (event.target as IDBOpenDBRequest).result
      resolve(_db)
    }

    req.onerror = () => reject(req.error)
  })
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

function tx(
  db: IDBDatabase,
  stores: string | string[],
  mode: IDBTransactionMode = 'readonly'
): IDBTransaction {
  return db.transaction(stores, mode)
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    req.onsuccess = () => res(req.result)
    req.onerror   = () => rej(req.error)
  })
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function idbGetAllSessions(): Promise<Record<string, unknown>[]> {
  const db    = await openDb()
  const store = tx(db, 'sessions').objectStore('sessions')
  const all   = await wrap<Record<string, unknown>[]>(store.getAll())
  return all.sort((a, b) =>
    String(b.startTime).localeCompare(String(a.startTime))
  )
}

export async function idbUpsertSession(session: Record<string, unknown>): Promise<void> {
  const db = await openDb()
  await wrap(tx(db, 'sessions', 'readwrite').objectStore('sessions').put(session))
  await enqueueSync('sessions', 'upsert', session)
}

export async function idbDeleteSession(id: string): Promise<void> {
  const db = await openDb()
  await wrap(tx(db, 'sessions', 'readwrite').objectStore('sessions').delete(id))
  await enqueueSync('sessions', 'delete', { id })
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function idbGetAllProjects(): Promise<Record<string, unknown>[]> {
  const db = await openDb()
  return wrap<Record<string, unknown>[]>(
    tx(db, 'projects').objectStore('projects').getAll()
  )
}

export async function idbUpsertProject(project: Record<string, unknown>): Promise<void> {
  const db = await openDb()
  await wrap(tx(db, 'projects', 'readwrite').objectStore('projects').put(project))
  await enqueueSync('projects', 'upsert', project)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function idbGetSettings(): Promise<Record<string, unknown> | null> {
  const db  = await openDb()
  const row = await wrap<Record<string, unknown> | undefined>(
    tx(db, 'settings').objectStore('settings').get(1)
  )
  return row ?? null
}

export async function idbSaveSettings(settings: Record<string, unknown>): Promise<void> {
  const db = await openDb()
  await wrap(
    tx(db, 'settings', 'readwrite')
      .objectStore('settings')
      .put({ ...settings, id: 1 })
  )
  await enqueueSync('settings', 'upsert', { ...settings, id: 1 })
}

// ─── Sync queue ───────────────────────────────────────────────────────────────

async function enqueueSync(
  store: string,
  operation: SyncOperation,
  payload: Record<string, unknown>
): Promise<void> {
  const db   = await openDb()
  const item: SyncQueueItem = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    store,
    operation,
    payload,
    createdAt: new Date().toISOString(),
  }
  await wrap(
    tx(db, 'sync_queue', 'readwrite').objectStore('sync_queue').put(item)
  )
}

export async function idbGetPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await openDb()
  return wrap<SyncQueueItem[]>(
    tx(db, 'sync_queue').objectStore('sync_queue').getAll()
  )
}

export async function idbRemoveSyncItem(id: string): Promise<void> {
  const db = await openDb()
  await wrap(
    tx(db, 'sync_queue', 'readwrite').objectStore('sync_queue').delete(id)
  )
}
