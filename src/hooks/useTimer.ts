/**
 * hooks/useTimer.ts
 * Provides a tick-every-second subscription tied to a session start time.
 * Returns elapsed seconds so components stay in sync without duplicating
 * setInterval logic.
 */

import { useState, useEffect, useRef } from 'react'

interface UseTimerOptions {
  /** Whether the timer should be running */
  active: boolean
  /** Epoch ms when the current work period started */
  startMs: number | null
  /** Tick interval in milliseconds (default: 1000) */
  intervalMs?: number
}

interface UseTimerReturn {
  /** Total elapsed seconds (never negative) */
  elapsedSeconds: number
  /** Formatted HH:MM:SS string */
  formatted: string
}

function pad(n: number): string {
  return String(Math.floor(n)).padStart(2, '0')
}

export function useTimer({
  active,
  startMs,
  intervalMs = 1000,
}: UseTimerOptions): UseTimerReturn {
  const [elapsedSeconds, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active || startMs === null) {
      setElapsed(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const tick = () => {
      setElapsed(Math.max(0, (Date.now() - startMs) / 1000))
    }

    tick() // immediate first tick
    intervalRef.current = setInterval(tick, intervalMs)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active, startMs, intervalMs])

  const h = elapsedSeconds / 3600
  const m = (elapsedSeconds % 3600) / 60
  const s = elapsedSeconds % 60
  const formatted = `${pad(h)}:${pad(m)}:${pad(s)}`

  return { elapsedSeconds, formatted }
}
