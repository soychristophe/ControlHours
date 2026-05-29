/**
 * components/SyncBadge.tsx
 * Small pill shown in page headers to indicate online/offline + sync state.
 * Tapping it triggers a manual sync.
 */

import { Wifi, WifiOff, RefreshCw, CloudOff } from 'lucide-react'
import { useSync } from '@/hooks/useSync'

interface SyncBadgeProps {
  className?: string
}

export function SyncBadge({ className = '' }: SyncBadgeProps) {
  const { isSyncing, pendingCount, syncNow } = useSync()
  const isOnline = navigator.onLine

  if (!isOnline) {
    return (
      <span
        className={`
          inline-flex items-center gap-1.5
          font-mono text-[10px] tracking-wider
          px-2.5 py-1.5 rounded-pill border
          text-text-muted border-surface-border bg-surface-card
          ${className}
        `}
      >
        <WifiOff size={12} />
        Offline
        {pendingCount > 0 && (
          <span className="bg-amber-hrDim text-amber-hr px-1 rounded text-[9px] font-bold">
            {pendingCount}
          </span>
        )}
      </span>
    )
  }

  if (isSyncing) {
    return (
      <span
        className={`
          inline-flex items-center gap-1.5
          font-mono text-[10px] tracking-wider
          px-2.5 py-1.5 rounded-pill border
          text-accent border-accent/30 bg-accent/10
          ${className}
        `}
      >
        <RefreshCw size={12} className="animate-spin" />
        Syncing
      </span>
    )
  }

  if (pendingCount > 0) {
    return (
      <button
        onClick={syncNow}
        className={`
          inline-flex items-center gap-1.5
          font-mono text-[10px] tracking-wider
          px-2.5 py-1.5 rounded-pill border
          text-amber-400 border-amber-400/30 bg-amber-400/10
          active:scale-95 transition-transform
          ${className}
        `}
        title="Tap to sync pending changes"
      >
        <CloudOff size={12} />
        Sync ({pendingCount})
      </button>
    )
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        font-mono text-[10px] tracking-wider
        px-2.5 py-1.5 rounded-pill border
        text-accent border-accent/30 bg-accent/10
        ${className}
      `}
    >
      <Wifi size={12} />
      Online
    </span>
  )
}
