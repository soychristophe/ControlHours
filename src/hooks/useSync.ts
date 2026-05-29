/**
 * hooks/useSync.ts
 * Watches online/offline status and flushes the IndexedDB sync queue
 * to the Cloudflare Pages API (D1) whenever connectivity is restored.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  idbGetPendingSyncItems,
  idbRemoveSyncItem,
  type SyncQueueItem,
} from '@/db/offline'
import { useAppStore } from '@/store'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ─── Per-store upload handlers ────────────────────────────────────────────────

async function uploadItem(item: SyncQueueItem): Promise<void> {
  const { store, operation, payload } = item

  if (store === 'sessions') {
    if (operation === 'upsert') {
      await fetch(`${API_BASE}/api/sessions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
    } else {
      await fetch(`${API_BASE}/api/sessions/${payload.id}`, { method: 'DELETE' })
    }
    return
  }

  if (store === 'projects') {
    await fetch(`${API_BASE}/api/projects`, {
      method:  operation === 'upsert' ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    return
  }

  if (store === 'settings') {
    await fetch(`${API_BASE}/api/settings`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    return
  }

  if (store === 'hourly-rates') {
    if (operation === 'upsert') {
      await fetch(`${API_BASE}/api/hourly-rates`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
    } else {
      await fetch(
        `${API_BASE}/api/hourly-rates?id=${encodeURIComponent((payload as { id: string }).id)}`,
        { method: 'DELETE' }
      )
    }
    return
  }

  if (store === 'public-holidays') {
    if (operation === 'upsert') {
      await fetch(`${API_BASE}/api/public-holidays`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
    } else {
      await fetch(
        `${API_BASE}/api/public-holidays?id=${encodeURIComponent((payload as { id: string }).id)}`,
        { method: 'DELETE' }
      )
    }
    return
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSyncReturn {
  isSyncing:    boolean
  lastSyncedAt: Date | null
  pendingCount: number
  syncNow:      () => Promise<void>
}

export function useSync(): UseSyncReturn {
  const storeSyncedAt = useAppStore((s) => s.lastSyncedAt)

  const [isSyncing,    setIsSyncing]   = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSyncedAt, setLocalSynced] = useState<Date | null>(
    storeSyncedAt ? new Date(storeSyncedAt) : null
  )

  const syncingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    const items = await idbGetPendingSyncItems()
    setPendingCount(items.length)
  }, [])

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setIsSyncing(true)

    try {
      const items = await idbGetPendingSyncItems()
      if (items.length === 0) return

      for (const item of items) {
        try {
          await uploadItem(item)
          await idbRemoveSyncItem(item.id)
        } catch {
          console.warn('[sync] failed to upload item', item.id)
        }
      }

      const now = new Date()
      setLocalSynced(now)
      useAppStore.setState({ lastSyncedAt: now })
    } finally {
      syncingRef.current = false
      setIsSyncing(false)
      await refreshPendingCount()
    }
  }, [refreshPendingCount])

  useEffect(() => {
    refreshPendingCount()

    function handleOnline() { syncNow() }
    window.addEventListener('online', handleOnline)
    syncNow()

    const interval = setInterval(() => {
      if (navigator.onLine) syncNow()
    }, 5 * 60_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [syncNow, refreshPendingCount])

  return { isSyncing, lastSyncedAt, pendingCount, syncNow }
}
