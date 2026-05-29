/**
 * components/SessionCard.tsx
 * Reusable session card — respects the global 24h / 12h time format.
 */

import { Clock, Coffee, Trash2, AlertCircle } from 'lucide-react'
import { useAppStore }  from '@/store'
import { formatTime }   from '@/utils/formatTime'
import { netWorkedMinutes, minutesToHours } from '@/utils/payroll'
import type { WorkSession } from '@/types'

const SHIFT_META: Record<string, { label: string; textCls: string; borderCls: string; bgCls: string }> = {
  regular:      { label: 'Regular',      textCls: 'text-accent',    borderCls: 'border-accent/30',    bgCls: 'bg-accent/10'    },
  overtime:     { label: 'Overtime',     textCls: 'text-amber-400', borderCls: 'border-amber-400/30', bgCls: 'bg-amber-400/10' },
  bank_holiday: { label: 'Bank Holiday', textCls: 'text-violet-400',borderCls: 'border-violet-400/30',bgCls: 'bg-violet-400/10'},
  sunday:       { label: 'Sunday',       textCls: 'text-sky-400',   borderCls: 'border-sky-400/30',   bgCls: 'bg-sky-400/10'   },
}

interface SessionCardProps {
  session:   WorkSession
  onDelete?: (id: string) => void
  isLive?:   boolean
}

export function SessionCard({ session, onDelete, isLive }: SessionCardProps) {
  const timeFmt = useAppStore((s) => s.timeFormat)

  const hours   = minutesToHours(netWorkedMinutes(session))
  const shift   = SHIFT_META[session.shiftType] ?? SHIFT_META.regular

  const breakMinutes = session.breaks
    .filter((b) => !b.isPaid && b.endTime)
    .reduce((acc, b) => acc + (new Date(b.endTime!).getTime() - new Date(b.startTime).getTime()) / 60_000, 0)

  const hasOpenBreak = session.breaks.some((b) => !b.endTime)

  return (
    <div className="bg-surface-card border border-surface-border rounded-card p-4 flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-text-secondary font-mono text-sm">
          <Clock size={13} className="text-text-muted shrink-0" />
          <span>{formatTime(session.startTime, timeFmt)}</span>
          <span className="text-text-muted">→</span>
          <span>
            {session.endTime
              ? formatTime(session.endTime, timeFmt)
              : <span className="text-accent animate-pulse">now</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
          <span className={`font-mono text-[9px] tracking-widest uppercase border rounded-pill px-2 py-0.5 shrink-0 ${shift.textCls} ${shift.borderCls} ${shift.bgCls}`}>
            {shift.label}
          </span>
        </div>
      </div>

      {/* Hours + breaks */}
      <div className="flex items-center gap-5">
        <div>
          <p className="font-mono text-xl font-medium text-text-primary leading-none">
            {hours.toFixed(2)}<span className="text-xs text-text-muted ml-1">hrs</span>
          </p>
          <p className="text-xs text-text-muted mt-0.5">net worked</p>
        </div>
        {session.breaks.length > 0 && (
          <div className="flex items-center gap-1.5 text-text-muted text-xs font-mono">
            <Coffee size={12} />
            <span>{session.breaks.length} break{session.breaks.length > 1 ? 's' : ''}{breakMinutes > 0 && ` · ${Math.round(breakMinutes)} min`}</span>
            {hasOpenBreak && <AlertCircle size={12} className="text-amber-400" />}
          </div>
        )}
      </div>

      {/* Note */}
      {session.note && (
        <p className="text-sm text-text-secondary border-t border-surface-border pt-2 leading-snug">{session.note}</p>
      )}

      {/* Delete */}
      {onDelete && (
        <button onClick={() => onDelete(session.id)} className="self-end flex items-center gap-1.5 text-xs text-text-muted hover:text-danger font-mono tracking-wider transition-colors" aria-label="Delete session">
          <Trash2 size={12} /> Remove
        </button>
      )}
    </div>
  )
}
