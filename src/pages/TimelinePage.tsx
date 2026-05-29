/**
 * pages/TimelinePage.tsx
 *
 * Layout
 *  ┌──────────────────────────────────────────────────┐
 *  │  [📅]      Wed 27 May 2026       [+]             │
 *  │  Mo  Tu  We  Th  Fr  Sa  Su                      │
 *  ├──────────────────────────────────────────────────┤
 *  │  Timeline (hours left, session blocks right)     │
 *  └──────────────────────────────────────────────────┘
 *  [floating: Back to Today]
 *
 * Changes vs v1
 *  • Add/Edit drawer: start + end use datetime-local (date+time together)
 *  • No shift-type selector (auto-calculated by the app later)
 *  • Tapping a session block opens the edit drawer
 *  • "Back to Today" floating button when not viewing today
 *  • All time labels respect the 24h / 12h store setting
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import { CalendarDays, Plus, X, ChevronLeft, ChevronRight, FileText, CalendarClock } from 'lucide-react'
import { useAppStore }  from '@/store'
import { netWorkedMinutes } from '@/utils/payroll'
import { formatTime, formatDuration, toDatetimeLocal, type TimeFormat } from '@/utils/formatTime'
import type { WorkSession } from '@/types'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  // Use local date (not UTC) to avoid off-by-one at midnight in IST (UTC+1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mondayOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const diff = (r.getDay() + 6) % 7
  r.setDate(r.getDate() - diff)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function fmtMonthYear(d: Date) {
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Timeline constants ───────────────────────────────────────────────────────

const DAY_START  = 0
const DAY_END    = 23
const HOUR_H     = 56
const HOURS      = Array.from({ length: 24 }, (_, i) => i)

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  background: '#0a0f0d', border: '1px solid #1f3028',
  borderRadius: 10, padding: '9px 12px',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13, color: '#e2ffe8', outline: 'none',
  width: '100%', boxSizing: 'border-box',
  colorScheme: 'dark',
}

// ─── Current time line ────────────────────────────────────────────────────────

function CurrentTimeLine({ selectedKey }: { selectedKey: string }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (isoDate(now) !== selectedKey) return null
  const h = now.getHours() + now.getMinutes() / 60
  if (h < DAY_START || h > DAY_END) return null
  const pct = ((h - DAY_START) / (DAY_END - DAY_START + 1)) * 100

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: `${pct}%`, height: 2, background: 'rgba(34,197,94,.55)', zIndex: 10 }}>
      <div style={{ position: 'absolute', left: -3, top: -3, width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
    </div>
  )
}

// ─── Session block (tappable) ─────────────────────────────────────────────────

const BLOCK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  regular:      { bg: 'rgba(34,197,94,.14)',   border: '#22c55e', text: '#4ade80' },
  overtime:     { bg: 'rgba(245,158,11,.14)',  border: '#f59e0b', text: '#fbbf24' },
  bank_holiday: { bg: 'rgba(167,139,250,.14)', border: '#a78bfa', text: '#c4b5fd' },
  sunday:       { bg: 'rgba(56,189,248,.14)',  border: '#38bdf8', text: '#7dd3fc' },
}

function SessionBlock({
  session,
  selectedKey,
  timeFmt,
  onClick,
}: {
  session:     WorkSession
  selectedKey: string
  timeFmt:     TimeFormat
  onClick:     (s: WorkSession) => void
}) {
  const start  = new Date(session.startTime)
  const end    = session.endTime ? new Date(session.endTime) : new Date()

  // For multi-day sessions, clip to the boundaries of selectedKey's day
  const dayStart = new Date(selectedKey + 'T00:00:00')
  const dayEnd   = new Date(selectedKey + 'T23:59:59')

  const clippedStart = start < dayStart ? dayStart : start
  const clippedEnd   = end   > dayEnd   ? dayEnd   : end

  const startH = clippedStart.getHours() + clippedStart.getMinutes() / 60
  const endH   = clippedEnd.getHours()   + clippedEnd.getMinutes()   / 60

  const topPct = ((Math.max(startH, DAY_START) - DAY_START) / (DAY_END - DAY_START + 1)) * 100
  const hPct   = ((Math.min(endH, DAY_END + 1) - Math.max(startH, DAY_START)) / (DAY_END - DAY_START + 1)) * 100
  const c      = BLOCK_COLORS[session.shiftType] ?? BLOCK_COLORS.regular
  const hrs    = (netWorkedMinutes(session) / 60).toFixed(2)
  const isLive = !session.endTime

  return (
    <div
      onClick={() => onClick(session)}
      style={{
        position: 'absolute', top: `${topPct}%`, height: `${Math.max(hPct, 1.6)}%`,
        left: 0, right: 0,
        background: c.bg, borderLeft: `3px solid ${c.border}`,
        borderRadius: '0 10px 10px 0', padding: '6px 8px',
        overflow: 'hidden', boxSizing: 'border-box',
        cursor: 'pointer', transition: 'filter .15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.25)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {isLive && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.border, flexShrink: 0, animation: 'tl-pulse 1.4s ease-in-out infinite' }} />
        )}
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 500, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatTime(start, timeFmt)} – {session.endTime ? formatTime(session.endTime, timeFmt) : 'now'} · {hrs}h
        </span>
      </div>
      {session.note && (
        <p style={{ fontSize: 11, color: 'rgba(226,255,232,.55)', marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {session.note}
        </p>
      )}
    </div>
  )
}

// ─── Timeline grid ────────────────────────────────────────────────────────────

function TimelineGrid({
  sessions,
  selectedKey,
  timeFmt,
  onBlockClick,
}: {
  sessions:     WorkSession[]
  selectedKey:  string
  timeFmt:      TimeFormat
  onBlockClick: (s: WorkSession) => void
}) {
  const totalH = HOURS.length * HOUR_H
  return (
    <div style={{ display: 'flex', paddingBottom: 16 }}>
      {/* Hour labels */}
      <div style={{ width: 40, flexShrink: 0 }}>
        {HOURS.map((h) => (
          <div key={h} style={{ height: HOUR_H, display: 'flex', alignItems: 'flex-start', paddingTop: 2, fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#4d7a5e' }}>
            {timeFmt === '24h'
              ? String(h).padStart(2, '0')
              : `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`}
          </div>
        ))}
      </div>

      {/* Blocks area */}
      <div style={{ flex: 1, position: 'relative', height: totalH }}>
        <style>{`@keyframes tl-pulse { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>

        {HOURS.map((h, i) => (
          <div key={h} style={{ position: 'absolute', top: i * HOUR_H, left: 0, right: 0, height: 1, background: i === 0 ? '#1f3028' : 'rgba(31,48,40,.45)' }} />
        ))}

        <CurrentTimeLine selectedKey={selectedKey} />

        {sessions.length === 0 && (
          <div style={{ position: 'absolute', top: '35%', left: 0, right: 0, textAlign: 'center', color: '#4d7a5e', fontSize: 13 }}>
            No sessions this day
          </div>
        )}

        {sessions.map((s) => (
          <SessionBlock key={s.id} session={s} selectedKey={selectedKey} timeFmt={timeFmt} onClick={onBlockClick} />
        ))}
      </div>
    </div>
  )
}

// ─── Week strip ───────────────────────────────────────────────────────────────

function WeekStrip({ monday, selected, onSelect, onSwipe }: { monday: Date; selected: Date; onSelect: (d: Date) => void; onSwipe: (dir: number) => void }) {
  const today  = isoDate(new Date())
  const selKey = isoDate(selected)
  const DOW    = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  // Touch swipe state
  const touchStartX = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) onSwipe(dx < 0 ? 1 : -1)
    touchStartX.current = null
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ display: 'flex', gap: 4, padding: '10px 0 12px', borderBottom: '1px solid #1f3028', userSelect: 'none' }}
    >
      {DOW.map((label, i) => {
        const day    = addDays(monday, i)
        const key    = isoDate(day)
        const isTd   = key === today
        const isSel  = key === selKey
        return (
          <button key={key} onClick={() => onSelect(day)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '.1em', color: isSel ? '#22c55e' : '#4d7a5e' }}>
              {label}
            </span>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: isSel || isTd ? 600 : 400,
              background: isSel ? '#22c55e' : isTd ? 'rgba(34,197,94,.15)' : 'transparent',
              color: isSel ? '#0a0f0d' : isTd ? '#22c55e' : '#8fba9c',
              border: isTd && !isSel ? '1px solid rgba(34,197,94,.4)' : '1px solid transparent',
            }}>
              {day.getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Mini calendar popover ────────────────────────────────────────────────────

function CalendarPopover({ selected, onSelect, onClose }: { selected: Date; onSelect: (d: Date) => void; onClose: () => void }) {
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [onClose])

  const year    = view.getFullYear()
  const month   = view.getMonth()
  const label   = view.toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })
  const offset  = (new Date(year, month, 1).getDay() + 6) % 7
  const daysIn  = new Date(year, month + 1, 0).getDate()
  const today   = isoDate(new Date())
  const selKey  = isoDate(selected)

  return (
    <div ref={ref} style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 100, background: '#111a16', border: '1px solid #1f3028', borderRadius: 16, padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setView(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8fba9c', padding: 4, display: 'flex' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#e2ffe8', fontWeight: 500 }}>{label}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8fba9c', padding: 4, display: 'flex' }}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#4d7a5e', paddingBottom: 4 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const day = new Date(year, month, i + 1)
          const key = isoDate(day)
          return (
            <button key={key} onClick={() => { onSelect(day); onClose() }}
              style={{ height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, background: key === selKey ? '#22c55e' : key === today ? 'rgba(34,197,94,.15)' : 'transparent', color: key === selKey ? '#0a0f0d' : key === today ? '#22c55e' : '#8fba9c', fontWeight: key === selKey || key === today ? 600 : 400 }}>
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shared drawer shell ──────────────────────────────────────────────────────

function DrawerShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#111a16', border: '1px solid #1f3028', borderRadius: '20px 20px 0 0', padding: '20px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#e2ffe8' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4d7a5e', display: 'flex' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '.12em', color: '#4d7a5e', textTransform: 'uppercase', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
      {children}
    </p>
  )
}

function DurationStrip({ start, end }: { start: string; end: string }) {
  const dur = start && end ? formatDuration(new Date(start), new Date(end)) : '—'
  return (
    <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#4d7a5e' }}>Duration</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: dur === '—' ? '#4d7a5e' : '#22c55e' }}>{dur}</span>
    </div>
  )
}

function SaveBtn({ onClick, label = 'Save Session' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{ background: '#22c55e', color: '#0a0f0d', border: 'none', borderRadius: 14, padding: 14, fontWeight: 600, fontSize: 15, cursor: 'pointer', width: '100%' }}>
      {label}
    </button>
  )
}

// ─── Add session drawer ───────────────────────────────────────────────────────

function AddSessionDrawer({ defaultDate, onClose }: { defaultDate: Date; onClose: () => void }) {
  const addManualSession = useAppStore((s) => s.addManualSession)

  const makeDefault = (h: number, m: number) => {
    const d = new Date(defaultDate); d.setHours(h, m, 0, 0); return toDatetimeLocal(d)
  }

  const [startDT, setStartDT] = useState(makeDefault(9, 0))
  const [endDT,   setEndDT]   = useState(makeDefault(17, 30))
  const [note,    setNote]    = useState('')
  const [error,   setError]   = useState('')

  function handleSave() {
    const s = new Date(startDT), e = new Date(endDT)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) { setError('Please fill in both date and time'); return }
    if (e <= s) { setError('End must be after start'); return }
    addManualSession({ startTime: s, endTime: e, breaks: [], shiftType: 'regular', note, projectId: null })
    onClose()
  }

  return (
    <DrawerShell title="Add session" onClose={onClose}>
      <div>
        <FieldLabel>Start — date &amp; time</FieldLabel>
        <input type="datetime-local" value={startDT} onChange={(e) => { setStartDT(e.target.value); setError('') }} style={INPUT} />
      </div>
      <div>
        <FieldLabel>End — date &amp; time</FieldLabel>
        <input type="datetime-local" value={endDT} onChange={(e) => { setEndDT(e.target.value); setError('') }} style={INPUT} />
      </div>
      <DurationStrip start={startDT} end={endDT} />
      <div>
        <FieldLabel><FileText size={11} /> Note (optional)</FieldLabel>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on?" rows={2} style={{ ...INPUT, resize: 'none', fontFamily: "'DM Sans',sans-serif" }} />
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{error}</p>}
      <SaveBtn onClick={handleSave} />
    </DrawerShell>
  )
}

// ─── Edit session drawer ──────────────────────────────────────────────────────

function EditSessionDrawer({ session, onClose }: { session: WorkSession; onClose: () => void }) {
  const updateSession = useAppStore((s) => s.updateSession)
  const deleteSession = useAppStore((s) => s.deleteSession)

  const [startDT, setStartDT] = useState(toDatetimeLocal(new Date(session.startTime)))
  const [endDT,   setEndDT]   = useState(session.endTime ? toDatetimeLocal(new Date(session.endTime)) : '')
  const [note,    setNote]    = useState(session.note)
  const [error,   setError]   = useState('')

  function handleSave() {
    const s = new Date(startDT)
    if (isNaN(s.getTime())) { setError('Invalid start date/time'); return }
    const updates: Partial<Omit<WorkSession, 'id'>> = { startTime: s, note }
    if (endDT) {
      const e = new Date(endDT)
      if (isNaN(e.getTime())) { setError('Invalid end date/time'); return }
      if (e <= s) { setError('End must be after start'); return }
      updates.endTime = e
    }
    updateSession(session.id, updates)
    onClose()
  }

  function handleDelete() {
    deleteSession(session.id)
    onClose()
  }

  return (
    <DrawerShell title="Edit session" onClose={onClose}>
      <div>
        <FieldLabel>Start — date &amp; time</FieldLabel>
        <input type="datetime-local" value={startDT} onChange={(e) => { setStartDT(e.target.value); setError('') }} style={INPUT} />
      </div>
      <div>
        <FieldLabel>End — date &amp; time</FieldLabel>
        <input type="datetime-local" value={endDT} onChange={(e) => { setEndDT(e.target.value); setError('') }} style={INPUT} />
      </div>
      {startDT && endDT && <DurationStrip start={startDT} end={endDT} />}
      <div>
        <FieldLabel><FileText size={11} /> Note</FieldLabel>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on?" rows={2} style={{ ...INPUT, resize: 'none', fontFamily: "'DM Sans',sans-serif" }} />
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{error}</p>}
      <SaveBtn onClick={handleSave} label="Save Changes" />
      <button onClick={handleDelete} style={{ background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: 12, fontWeight: 500, fontSize: 14, cursor: 'pointer', width: '100%' }}>
        Delete Session
      </button>
    </DrawerShell>
  )
}

// ─── Back to Today button (floating, always-visible) ──────────────────────────

function BackToToday({ onPress }: { onPress: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
      left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 40,
    }}>
      <button
        onClick={onPress}
        style={{
          pointerEvents: 'all',
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#172019', border: '1px solid #22c55e',
          color: '#22c55e', borderRadius: 999,
          padding: '9px 18px', fontFamily: "'DM Sans',sans-serif",
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(34,197,94,.25)',
          animation: 'tl-fadein .2s ease-out',
        }}
      >
        <CalendarClock size={15} />
        Back to Today
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TimelinePage() {
  const sessions       = useAppStore((s) => s.sessions)
  const currentSession = useAppStore((s) => s.currentSession)
  const timeFmt        = useAppStore((s) => s.timeFormat)

  const [selectedDate,  setSelectedDate]  = useState(new Date())
  const [weekMonday,    setWeekMonday]    = useState(() => mondayOfWeek(new Date()))
  const [showCalendar,  setShowCalendar]  = useState(false)
  const [showAdd,       setShowAdd]       = useState(false)
  const [editSession,   setEditSession]   = useState<WorkSession | null>(null)

  const todayKey   = isoDate(new Date())
  const selectedKey = isoDate(selectedDate)
  const isToday    = selectedKey === todayKey

  function selectDate(d: Date) {
    setSelectedDate(d)
    setWeekMonday(mondayOfWeek(d))
  }

  function goToToday() {
    const today = new Date()
    selectDate(today)
    // Scroll timeline to current hour
    setTimeout(() => {
      const el = document.getElementById('tl-scroll')
      if (el) el.scrollTop = ((new Date().getHours() - 1) * HOUR_H)
    }, 50)
  }

  function shiftWeek(dir: number) {
    const m = addDays(weekMonday, dir * 7)
    setWeekMonday(m)
    setSelectedDate(m)
  }

  const daySessions = useMemo(() => {
    const all = currentSession ? [currentSession, ...sessions] : sessions
    // Include a session if it starts on selectedKey OR spans into selectedKey
    return all.filter((s) => {
      const startKey = isoDate(new Date(s.startTime))
      if (startKey === selectedKey) return true
      // Multi-day: session started before and ends on or after selectedKey
      if (s.endTime) {
        const endKey = isoDate(new Date(s.endTime))
        return startKey < selectedKey && endKey >= selectedKey
      }
      return false
    })
  }, [sessions, currentSession, selectedKey])

  // Scroll to 8 AM on first render / date change
  useEffect(() => {
    const el = document.getElementById('tl-scroll')
    if (el) el.scrollTop = (8 * HOUR_H) - 20
  }, [selectedKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @keyframes tl-fadein { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        input[type="datetime-local"] { color-scheme: dark; }
      `}</style>

      {/* ── Sticky header + week strip ──────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#0a0f0d', position: 'relative', zIndex: 50 }}>
        {/* Header */}
        <div style={{ padding: '28px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setShowCalendar((v) => !v)}
              style={{ background: showCalendar ? 'rgba(34,197,94,.12)' : 'transparent', border: `1px solid ${showCalendar ? 'rgba(34,197,94,.3)' : '#1f3028'}`, borderRadius: 10, padding: '7px 9px', cursor: 'pointer', color: showCalendar ? '#22c55e' : '#4d7a5e', display: 'flex' }}
            >
              <CalendarDays size={18} />
            </button>

            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, letterSpacing: '.14em', color: '#4d7a5e', textTransform: 'uppercase', marginBottom: 1 }}>Timeline</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <button onClick={() => shiftWeek(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4d7a5e', padding: 2, display: 'flex' }}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e2ffe8' }}>{fmtMonthYear(selectedDate)}</span>
                <button onClick={() => shiftWeek(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4d7a5e', padding: 2, display: 'flex' }}><ChevronRight size={14} /></button>
              </div>
            </div>

            <button onClick={() => setShowAdd(true)} style={{ background: '#22c55e', border: 'none', borderRadius: 10, padding: '7px 9px', cursor: 'pointer', color: '#0a0f0d', display: 'flex' }}>
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>

          {showCalendar && (
            <CalendarPopover selected={selectedDate} onSelect={selectDate} onClose={() => setShowCalendar(false)} />
          )}
        </div>

        {/* Week strip */}
        <div style={{ padding: '0 16px' }}>
          <WeekStrip monday={weekMonday} selected={selectedDate} onSelect={selectDate} onSwipe={shiftWeek} />
        </div>
      </div>

      {/* ── Timeline scroll area ────────────────────────────────────────── */}
      <div id="tl-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 0', paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        <TimelineGrid
          sessions={daySessions}
          selectedKey={selectedKey}
          timeFmt={timeFmt}
          onBlockClick={(s) => setEditSession(s)}
        />
      </div>

      {/* ── Back to Today (floating) ────────────────────────────────────── */}
      {!isToday && <BackToToday onPress={goToToday} />}

      {/* ── Drawers ─────────────────────────────────────────────────────── */}
      {showAdd && <AddSessionDrawer defaultDate={selectedDate} onClose={() => setShowAdd(false)} />}
      {editSession && <EditSessionDrawer session={editSession} onClose={() => setEditSession(null)} />}
    </div>
  )
}
