/**
 * pages/TaskPage.tsx
 * Clock-in / clock-out page — no break option, no rate card.
 * Includes an inline note field attached to the active session.
 */

import { useState, useEffect, useRef } from 'react'
import { Play, Square, Briefcase, FileText } from 'lucide-react'
import { useAppStore } from '@/store'
import { netWorkedMinutes, minutesToHours } from '@/utils/payroll'

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, '0')
}

function formatElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  const s = Math.floor((minutes * 60) % 60)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function TaskPage() {
  const currentSession = useAppStore((s) => s.currentSession)
  const sessions       = useAppStore((s) => s.sessions)
  const payroll        = useAppStore((s) => s.payrollSettings)
  const startSession   = useAppStore((s) => s.startSession)
  const stopSession    = useAppStore((s) => s.stopSession)
  const updateNote     = useAppStore((s) => s.updateSessionNote)

  const [now, setNow]       = useState(new Date())
  const [note, setNote]     = useState('')
  const [showNote, setShowNote] = useState(false)
  const noteRef             = useRef<HTMLTextAreaElement>(null)

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Sync note field when session changes
  useEffect(() => {
    setNote(currentSession?.note ?? '')
    if (!currentSession) setShowNote(false)
  }, [currentSession?.id])

  // Auto-focus textarea when shown
  useEffect(() => {
    if (showNote) noteRef.current?.focus()
  }, [showNote])

  const isRunning      = !!currentSession
  const elapsedMinutes = currentSession ? netWorkedMinutes(currentSession) : 0

  const todayHours = sessions
    .filter((s) => {
      const d     = new Date(s.startTime)
      const today = new Date()
      return (
        d.getDate()     === today.getDate()   &&
        d.getMonth()    === today.getMonth()  &&
        d.getFullYear() === today.getFullYear()
      )
    })
    .reduce((acc, s) => acc + minutesToHours(netWorkedMinutes(s)), 0)

  const estimatedEarnings =
    (isRunning ? minutesToHours(elapsedMinutes) : 0) * payroll.hourlyRate

  function handleNoteBlur() {
    if (currentSession) updateNote(currentSession.id, note)
  }

  function handleClockOut() {
    if (currentSession) updateNote(currentSession.id, note)
    stopSession()
  }

  return (
    <div className="flex flex-col min-h-full px-4 pt-8 pb-4 gap-6">
      {/* Header */}
      <div>
        <p className="font-mono text-xs text-text-muted tracking-widest uppercase">
          {now.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-semibold text-text-primary mt-0.5">
          {isRunning ? 'Working' : 'Ready to clock in'}
        </h1>
      </div>

      {/* Clock display */}
      <div className="flex flex-col items-center py-8 gap-2">
        <p className="font-mono text-[64px] font-medium leading-none tracking-tight text-accent tabular-nums">
          {formatElapsed(elapsedMinutes)}
        </p>
        {isRunning && (
          <p className="font-mono text-sm text-text-secondary">
            ≈ €{estimatedEarnings.toFixed(2)} earned
          </p>
        )}
      </div>

      {/* Note area — only when a session is active */}
      {isRunning && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowNote((v) => !v)}
            className="
              flex items-center gap-2 self-start
              text-xs font-mono tracking-wider text-text-muted
              hover:text-text-secondary transition-colors
            "
          >
            <FileText size={14} />
            {showNote ? 'Hide note' : note ? 'Edit note' : 'Add a note'}
          </button>

          {showNote && (
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="What are you working on?"
              rows={3}
              className="
                w-full bg-surface-card border border-surface-border rounded-card
                px-3 py-3 text-sm text-text-primary placeholder:text-text-muted
                font-sans resize-none
                focus:outline-none focus:border-accent/50
                transition-colors
              "
            />
          )}

          {/* Note preview when collapsed */}
          {!showNote && note && (
            <p className="text-sm text-text-secondary italic line-clamp-2 pl-1">
              "{note}"
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {!isRunning ? (
          <button
            onClick={startSession}
            className="
              flex items-center justify-center gap-3
              bg-accent text-surface font-semibold text-lg
              rounded-card py-4
              active:scale-95 transition-transform
            "
          >
            <Play size={22} fill="currentColor" />
            Clock In
          </button>
        ) : (
          <button
            onClick={handleClockOut}
            className="
              flex items-center justify-center gap-3
              bg-danger/20 border border-danger/40 text-danger
              font-medium text-base rounded-card py-3.5
              active:scale-95 transition-transform
            "
          >
            <Square size={20} fill="currentColor" />
            Clock Out
          </button>
        )}
      </div>

      {/* Today summary — single stat */}
      <div className="mt-auto">
        <div className="bg-surface-card border border-surface-border rounded-card p-4">
          <p className="text-xs text-text-muted font-mono tracking-wider uppercase mb-1">
            Total today
          </p>
          <p className="font-mono text-2xl font-medium text-text-primary">
            {(todayHours + minutesToHours(elapsedMinutes)).toFixed(2)}
            <span className="text-sm text-text-muted ml-1">hrs</span>
          </p>
        </div>
      </div>

      {/* Empty state */}
      {sessions.length === 0 && !isRunning && (
        <div className="flex flex-col items-center text-center gap-2 py-4">
          <Briefcase size={32} className="text-text-muted opacity-40" />
          <p className="text-text-muted text-sm">No sessions yet — clock in to get started</p>
        </div>
      )}
    </div>
  )
}
