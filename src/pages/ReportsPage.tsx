/**
 * pages/ReportsPage.tsx
 * Enhanced pay period summary — fixed header/tabs/strip, scrollable content,
 * floating "Go to Today" button, calendar picker icon.
 */

import { useMemo, useState, useRef, useCallback } from 'react'
import { TrendingUp, CalendarDays } from 'lucide-react'
import { useAppStore } from '@/store'
import { buildPayPeriodSummary, netWorkedMinutes, minutesToHours } from '@/utils/payroll'
import { formatTime } from '@/utils/formatTime'
import type { PayPeriodSummary, WorkSession } from '@/types'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const DAY_SHORT   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monStart(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - (r.getDay() + 6) % 7)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function startOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r
}
function endOfDay(d: Date): Date {
  const r = new Date(d); r.setHours(23, 59, 59, 999); return r
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
}
function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999)
}
function isoWeekNumber(d: Date): number {
  const r = new Date(d); r.setHours(0, 0, 0, 0)
  r.setDate(r.getDate() - (r.getDay() + 6) % 7 + 3)
  const ys = new Date(r.getFullYear(), 0, 4)
  return 1 + Math.round(((r.getTime() - ys.getTime()) / 86_400_000 - 3 + (ys.getDay() + 6) % 7) / 7)
}
// ISO week string for <input type="week"> value: "2026-W21"
function isoWeekInputValue(d: Date): string {
  const mon = monStart(d)
  const wk  = isoWeekNumber(mon)
  return `${mon.getFullYear()}-W${String(wk).padStart(2, '0')}`
}
function pad2(n: number) { return String(n).padStart(2, '0') }
function toDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}
function toMonthInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`
}
function fmt(n: number): string {
  return n.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function sessionHours(s: WorkSession): number {
  return minutesToHours(netWorkedMinutes(s))
}
function sessionsInRange(sessions: WorkSession[], start: Date, end: Date): WorkSession[] {
  const seen = new Set<string>()
  return sessions.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    const d = new Date(s.startTime)
    return d >= start && d <= end
  })
}

type ViewMode = 'day' | 'week' | 'month' | 'year'

// ─── Is today? ────────────────────────────────────────────────────────────────

function isCurrentPeriod(mode: ViewMode, cursor: Date): boolean {
  const now = new Date()
  switch (mode) {
    case 'day':   return startOfDay(cursor).getTime() === startOfDay(now).getTime()
    case 'week':  return monStart(cursor).getTime() === monStart(now).getTime()
    case 'month': return cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()
    case 'year':  return cursor.getFullYear() === now.getFullYear()
  }
}

function periodRange(mode: ViewMode, cursor: Date): [Date, Date] {
  switch (mode) {
    case 'day':   return [startOfDay(cursor), endOfDay(cursor)]
    case 'week': { const mon = monStart(cursor); return [startOfDay(mon), endOfDay(addDays(mon, 6))] }
    case 'month': return [startOfMonth(cursor), endOfMonth(cursor)]
    case 'year':  return [startOfYear(cursor), endOfYear(cursor)]
  }
}
function advanceCursor(mode: ViewMode, cursor: Date, dir: 1 | -1): Date {
  switch (mode) {
    case 'day':   return addDays(cursor, dir)
    case 'week':  return addDays(cursor, dir * 7)
    case 'month': return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1)
    case 'year':  return new Date(cursor.getFullYear() + dir, 0, 1)
  }
}

// ─── Swipe ────────────────────────────────────────────────────────────────────

function useSwipe(onLeft: () => void, onRight: () => void) {
  const sx = useRef<number | null>(null)
  const onTouchStart = useCallback((e: React.TouchEvent) => { sx.current = e.touches[0].clientX }, [])
  const onTouchEnd   = useCallback((e: React.TouchEvent) => {
    if (sx.current === null) return
    const dx = e.changedTouches[0].clientX - sx.current
    if (Math.abs(dx) > 40) dx < 0 ? onLeft() : onRight()
    sx.current = null
  }, [onLeft, onRight])
  return { onTouchStart, onTouchEnd }
}

// ─── Summary cards ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className={`rounded-card p-4 border flex flex-col gap-1 ${
      accent ? 'bg-accent/10 border-accent/30' : 'bg-surface-card border-surface-border'
    }`}>
      <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">{label}</p>
      <p className={`font-mono text-2xl font-medium leading-none ${accent ? 'text-accent' : 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}
function TaxRow({ label, amount, rate }: { label: string; amount: number; rate?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {rate && <p className="text-xs text-text-muted font-mono">{rate}</p>}
      </div>
      <p className="font-mono text-sm font-medium text-text-primary">- €{fmt(amount)}</p>
    </div>
  )
}
function HrRow({ label, hrs, color }: { label: string; hrs: number; color: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={color}>{label}</span>
      <span className="font-mono text-text-primary">{hrs.toFixed(2)} hrs</span>
    </div>
  )
}

function PeriodSummary({ summary }: { summary: PayPeriodSummary }) {
  const totalDeductions = summary.estimatedPAYE + summary.estimatedUSC + summary.estimatedPRSI
  const totalHours = summary.regularHours + summary.overtimeHours + summary.bankHolidayHours + summary.sundayHours
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Gross Pay"    value={`€${fmt(summary.grossPay)}`}        sub="before deductions" />
        <SummaryCard label="Est. Net Pay" value={`€${fmt(summary.estimatedNetPay)}`} sub="take-home" accent />
        <SummaryCard label="Total Hours"  value={totalHours.toFixed(2)}              sub="hrs worked" />
        <SummaryCard label="Deductions"   value={`€${fmt(totalDeductions)}`}         sub="PAYE + PRSI + USC" />
      </div>
      {(summary.overtimeHours > 0 || summary.bankHolidayHours > 0 || summary.sundayHours > 0) && (
        <div className="bg-surface-card border border-surface-border rounded-card p-4">
          <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-3">Hours breakdown</p>
          <div className="flex flex-col gap-2">
            {summary.regularHours     > 0 && <HrRow label="Regular"           hrs={summary.regularHours}     color="text-text-secondary" />}
            {summary.overtimeHours    > 0 && <HrRow label="Overtime ×1.5"     hrs={summary.overtimeHours}    color="text-amber-400" />}
            {summary.sundayHours      > 0 && <HrRow label="Sunday ×1.5"       hrs={summary.sundayHours}      color="text-sky-400" />}
            {summary.bankHolidayHours > 0 && <HrRow label="Bank Holiday ×2.0" hrs={summary.bankHolidayHours} color="text-violet-400" />}
          </div>
        </div>
      )}
      <div className="bg-surface-card border border-surface-border rounded-card p-4">
        <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-1">Estimated deductions</p>
        <p className="text-xs text-text-muted mb-3">Estimates only — consult Revenue.ie for official figures</p>
        <TaxRow label="PAYE"            amount={summary.estimatedPAYE} rate="20% / 40% bands" />
        <TaxRow label="PRSI (employee)" amount={summary.estimatedPRSI} rate="Class A1 · 4.1%" />
        <TaxRow label="USC"             amount={summary.estimatedUSC}  rate="0.5% → 8% bands" />
        <div className="flex items-center justify-between pt-3 mt-1">
          <p className="text-sm font-semibold text-text-primary">Estimated net</p>
          <p className="font-mono text-lg font-semibold text-accent">€{fmt(summary.estimatedNetPay)}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

interface BarDatum { label: string; hours: number; isActive?: boolean }

function HoursBarChart({ data, title }: { data: BarDatum[]; title: string }) {
  const maxHrs = Math.max(...data.map((d) => d.hours), 0.1)
  return (
    <div className="bg-surface-card border border-surface-border rounded-card p-4">
      <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-4">{title}</p>
      <div className="flex items-end gap-1.5 h-24">
        {data.map((d, i) => {
          const pct = (d.hours / maxHrs) * 100
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                <div
                  className={`w-full rounded-sm transition-all duration-500 ${d.isActive ? 'bg-accent' : 'bg-accent/25'}`}
                  style={{ height: `${Math.max(pct, d.hours > 0 ? 4 : 0)}%` }}
                />
              </div>
              <span className={`font-mono text-[9px] tracking-wide ${d.isActive ? 'text-accent' : 'text-text-muted'}`}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Session log ──────────────────────────────────────────────────────────────

const SHIFT_META: Record<string, { label: string; textCls: string; borderCls: string; bgCls: string }> = {
  regular:      { label: 'Regular',      textCls: 'text-accent',     borderCls: 'border-accent/30',     bgCls: 'bg-accent/10'     },
  overtime:     { label: 'Overtime',     textCls: 'text-amber-400',  borderCls: 'border-amber-400/30',  bgCls: 'bg-amber-400/10'  },
  bank_holiday: { label: 'Bank Holiday', textCls: 'text-violet-400', borderCls: 'border-violet-400/30', bgCls: 'bg-violet-400/10' },
  sunday:       { label: 'Sunday',       textCls: 'text-sky-400',    borderCls: 'border-sky-400/30',    bgCls: 'bg-sky-400/10'    },
}

function SessionLogItem({ session, timeFmt }: { session: WorkSession; timeFmt: '24h' | '12h' }) {
  const hours = sessionHours(session)
  const shift = SHIFT_META[session.shiftType] ?? SHIFT_META.regular
  return (
    <div className="bg-surface-card border border-surface-border rounded-card p-3 flex items-start gap-3">
      <div className="flex flex-col items-center min-w-[52px]">
        <span className="font-mono text-sm font-medium text-text-primary">{formatTime(session.startTime, timeFmt)}</span>
        <div className="w-px h-3 bg-surface-border my-0.5" />
        <span className="font-mono text-sm text-text-muted">
          {session.endTime ? formatTime(session.endTime, timeFmt) : <span className="text-accent animate-pulse text-xs">live</span>}
        </span>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {session.note
          ? <p className="text-sm text-text-secondary leading-snug line-clamp-2">{session.note}</p>
          : <p className="text-xs text-text-muted italic">No note</p>}
        <span className={`inline-block mt-1.5 font-mono text-[9px] tracking-widest uppercase border rounded-pill px-2 py-0.5 ${shift.textCls} ${shift.borderCls} ${shift.bgCls}`}>
          {shift.label}
        </span>
      </div>
      <div className="flex flex-col items-end pt-0.5">
        <span className="font-mono text-base font-semibold text-text-primary">{hours.toFixed(2)}</span>
        <span className="text-[10px] text-text-muted">hrs</span>
      </div>
    </div>
  )
}

interface DayGroup { dateKey: string; label: string; sessions: WorkSession[] }

function SessionLog({ sessions, timeFmt }: { sessions: WorkSession[]; timeFmt: '24h' | '12h' }) {
  const groups = useMemo<DayGroup[]>(() => {
    const unique = Array.from(new Map(sessions.map((s) => [s.id, s])).values())
    const map = new Map<string, WorkSession[]>()
    for (const s of unique) {
      const d   = new Date(s.startTime)
      const key = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, slist]) => {
        const d      = new Date(key + 'T12:00:00')
        const label  = `Week ${isoWeekNumber(d)} · ${d.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}`
        return { dateKey: key, label, sessions: [...slist].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) }
      })
  }, [sessions])

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Session log</p>
      {groups.map((g) => {
        const dayTotal = g.sessions.reduce((acc, s) => acc + sessionHours(s), 0)
        return (
          <div key={g.dateKey} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-text-primary">{g.label}</p>
              <span className="font-mono text-xs text-accent">{dayTotal.toFixed(2)} hrs</span>
            </div>
            {g.sessions.map((s) => <SessionLogItem key={s.id} session={s} timeFmt={timeFmt} />)}
          </div>
        )
      })}
    </div>
  )
}

// ─── Date strips ─────────────────────────────────────────────────────────────

function DayStrip({ cursor, onSelect, sessions }: { cursor: Date; onSelect: (d: Date) => void; sessions: WorkSession[] }) {
  const mon   = monStart(cursor)
  const days  = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const today = startOfDay(new Date())
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => {
        const isSel   = startOfDay(d).getTime() === startOfDay(cursor).getTime()
        const isToday = startOfDay(d).getTime() === today.getTime()
        const hrs     = sessionsInRange(sessions, startOfDay(d), endOfDay(d)).reduce((a, s) => a + sessionHours(s), 0)
        return (
          <button key={i} onClick={() => onSelect(d)}
            className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg transition-colors ${
              isSel ? 'bg-accent' : isToday ? 'bg-accent/15' : 'hover:bg-surface-border/40'
            }`}
          >
            <span className={`font-mono text-[9px] tracking-widest uppercase ${isSel ? 'text-surface/70' : 'text-text-muted'}`}>{DAY_SHORT[i]}</span>
            <span className={`font-mono text-sm font-semibold ${isSel ? 'text-surface' : isToday ? 'text-accent' : 'text-text-primary'}`}>{d.getDate()}</span>
            {hrs > 0
              ? <span className={`font-mono text-[8px] ${isSel ? 'text-surface/60' : 'text-accent'}`}>{hrs.toFixed(1)}h</span>
              : <span className="text-[8px] opacity-0">·</span>}
          </button>
        )
      })}
    </div>
  )
}

function WeekStrip({ cursor, onSelect }: { cursor: Date; onSelect: (d: Date) => void }) {
  const curMon = monStart(cursor)
  const weeks  = [-1, 0, 1].map((o) => addDays(curMon, o * 7))
  return (
    <div className="grid grid-cols-3 gap-2">
      {weeks.map((mon, i) => {
        const sun   = addDays(mon, 6)
        const wk    = isoWeekNumber(mon)
        const isSel = mon.getTime() === curMon.getTime()
        const range = `${mon.getDate()} ${MONTH_SHORT[mon.getMonth()]} – ${sun.getDate()} ${MONTH_SHORT[sun.getMonth()]}`
        return (
          <button key={i} onClick={() => onSelect(mon)}
            className={`flex flex-col items-center gap-0.5 py-3 rounded-lg transition-colors ${isSel ? 'bg-accent' : 'hover:bg-surface-border/40'}`}
          >
            <span className={`font-mono text-[10px] tracking-widest uppercase ${isSel ? 'text-surface/70' : 'text-text-muted'}`}>Week</span>
            <span className={`font-mono text-xl font-semibold leading-none ${isSel ? 'text-surface' : 'text-text-primary'}`}>{wk}</span>
            <span className={`font-mono text-[9px] mt-0.5 ${isSel ? 'text-surface/60' : 'text-text-muted'}`}>{range}</span>
          </button>
        )
      })}
    </div>
  )
}

function MonthStrip({ cursor, onSelect }: { cursor: Date; onSelect: (d: Date) => void }) {
  const months = [-1, 0, 1].map((o) => new Date(cursor.getFullYear(), cursor.getMonth() + o, 1))
  return (
    <div className="grid grid-cols-3 gap-2">
      {months.map((m, i) => {
        const isSel = m.getFullYear() === cursor.getFullYear() && m.getMonth() === cursor.getMonth()
        return (
          <button key={i} onClick={() => onSelect(m)}
            className={`flex flex-col items-center py-3 rounded-lg transition-colors ${isSel ? 'bg-accent' : 'hover:bg-surface-border/40'}`}
          >
            <span className={`font-mono text-[10px] tracking-widest uppercase ${isSel ? 'text-surface/70' : 'text-text-muted'}`}>{m.getFullYear()}</span>
            <span className={`font-mono text-xl font-semibold mt-0.5 ${isSel ? 'text-surface' : 'text-text-primary'}`}>{MONTH_SHORT[m.getMonth()]}</span>
          </button>
        )
      })}
    </div>
  )
}

function YearStrip({ cursor, onSelect }: { cursor: Date; onSelect: (d: Date) => void }) {
  const years = [-1, 0, 1].map((o) => cursor.getFullYear() + o)
  return (
    <div className="grid grid-cols-3 gap-2">
      {years.map((y, i) => {
        const isSel = y === cursor.getFullYear()
        return (
          <button key={i} onClick={() => onSelect(new Date(y, 0, 1))}
            className={`py-3 rounded-lg font-mono text-xl font-semibold transition-colors ${isSel ? 'bg-accent text-surface' : 'text-text-primary hover:bg-surface-border/40'}`}
          >
            {y}
          </button>
        )
      })}
    </div>
  )
}

// ─── Calendar picker (invisible input, triggered by icon) ────────────────────

function CalendarPicker({ mode, cursor, onSelect }: {
  mode: ViewMode; cursor: Date; onSelect: (d: Date) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    if (mode === 'day') {
      onSelect(new Date(val + 'T12:00:00'))
    } else if (mode === 'week') {
      // val = "2026-W21" → parse to Monday of that week
      const [yearStr, wStr] = val.split('-W')
      const year = parseInt(yearStr)
      const week = parseInt(wStr)
      // Jan 4 is always in week 1
      const jan4  = new Date(year, 0, 4)
      const jan4Mon = monStart(jan4)
      const mon   = addDays(jan4Mon, (week - 1) * 7)
      onSelect(mon)
    } else if (mode === 'month') {
      const [y, m] = val.split('-').map(Number)
      onSelect(new Date(y, m - 1, 1))
    } else {
      onSelect(new Date(parseInt(val), 0, 1))
    }
  }

  // input type per mode
  const inputType = mode === 'day' ? 'date' : mode === 'week' ? 'week' : mode === 'month' ? 'month' : 'number'
  const inputValue = mode === 'day'   ? toDateInput(cursor)
                   : mode === 'week'  ? isoWeekInputValue(cursor)
                   : mode === 'month' ? toMonthInput(cursor)
                   : String(cursor.getFullYear())

  return (
    <div className="relative">
      <button
        onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.click()}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
        aria-label="Open date picker"
      >
        <CalendarDays size={16} />
      </button>
      <input
        ref={inputRef}
        type={inputType}
        value={inputValue}
        min={inputType === 'number' ? '2000' : undefined}
        max={inputType === 'number' ? '2099' : undefined}
        onChange={handleChange}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildDayChart(sessions: WorkSession[], cursor: Date): BarDatum[] {
  const mon = monStart(cursor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i)
    const hours = sessionsInRange(sessions, startOfDay(d), endOfDay(d)).reduce((a, s) => a + sessionHours(s), 0)
    return { label: DAY_SHORT[i], hours, isActive: startOfDay(d).getTime() === startOfDay(cursor).getTime() }
  })
}
function buildWeekChart(sessions: WorkSession[], cursor: Date): BarDatum[] {
  const curMon = monStart(cursor)
  return Array.from({ length: 5 }, (_, i) => {
    const mon   = addDays(curMon, (i - 2) * 7)
    const hours = sessionsInRange(sessions, startOfDay(mon), endOfDay(addDays(mon, 6))).reduce((a, s) => a + sessionHours(s), 0)
    return { label: `W${isoWeekNumber(mon)}`, hours, isActive: mon.getTime() === curMon.getTime() }
  })
}
function buildMonthChart(sessions: WorkSession[], cursor: Date): BarDatum[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d     = new Date(cursor.getFullYear(), cursor.getMonth() - 2 + i, 1)
    const hours = sessionsInRange(sessions, startOfMonth(d), endOfMonth(d)).reduce((a, s) => a + sessionHours(s), 0)
    return { label: MONTH_SHORT[d.getMonth()], hours, isActive: d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth() }
  })
}
function buildYearChart(sessions: WorkSession[], cursor: Date): BarDatum[] {
  return Array.from({ length: 5 }, (_, i) => {
    const y     = cursor.getFullYear() - 2 + i
    const hours = sessionsInRange(sessions, startOfYear(new Date(y, 0, 1)), endOfYear(new Date(y, 0, 1))).reduce((a, s) => a + sessionHours(s), 0)
    return { label: String(y), hours, isActive: y === cursor.getFullYear() }
  })
}
function dailyAvg(sessions: WorkSession[], start: Date, end: Date): number {
  const inRange = sessionsInRange(sessions, start, end)
  const total   = inRange.reduce((a, s) => a + sessionHours(s), 0)
  const days    = new Set(inRange.map((s) => startOfDay(new Date(s.startTime)).getTime())).size
  return days === 0 ? 0 : total / days
}

// ─── Mode tabs ────────────────────────────────────────────────────────────────

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'day',   label: 'Day'   },
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year'  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const sessions        = useAppStore((s) => s.sessions)
  const payrollSettings = useAppStore((s) => s.payrollSettings)
  const timeFmt         = useAppStore((s) => s.timeFormat)

  const [mode,   setMode]   = useState<ViewMode>('week')
  const [cursor, setCursor] = useState<Date>(new Date())

  function handleSetMode(m: ViewMode) { setMode(m); setCursor(new Date()) }

  const goNext = useCallback(() => setCursor((c) => advanceCursor(mode, c, 1)),  [mode])
  const goPrev = useCallback(() => setCursor((c) => advanceCursor(mode, c, -1)), [mode])
  const swipe  = useSwipe(goNext, goPrev)

  const [periodStart, periodEnd] = useMemo(() => periodRange(mode, cursor), [mode, cursor])

  const summary = useMemo<PayPeriodSummary>(
    () => buildPayPeriodSummary(sessions, payrollSettings, periodStart, periodEnd),
    [sessions, payrollSettings, periodStart, periodEnd]
  )
  const periodSessions = useMemo(
    () => sessionsInRange(sessions, periodStart, periodEnd),
    [sessions, periodStart, periodEnd]
  )
  const totalHours = summary.regularHours + summary.overtimeHours + summary.bankHolidayHours + summary.sundayHours
  const avgHours   = useMemo(() => dailyAvg(sessions, periodStart, periodEnd), [sessions, periodStart, periodEnd])
  const chartData  = useMemo(() => {
    switch (mode) {
      case 'day':   return buildDayChart(sessions, cursor)
      case 'week':  return buildWeekChart(sessions, cursor)
      case 'month': return buildMonthChart(sessions, cursor)
      case 'year':  return buildYearChart(sessions, cursor)
    }
  }, [sessions, mode, cursor])

  const isEmpty    = periodSessions.length === 0
  const isCurrent  = isCurrentPeriod(mode, cursor)

  return (
    // Outer: full height, flex column, no scroll on this wrapper
    <div className="flex flex-col h-full">

      {/* ── FIXED TOP ZONE ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-8 pb-3 flex flex-col gap-4 bg-surface">

        {/* Header row: title + calendar picker */}
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-xs text-text-muted tracking-widest uppercase">Payroll</p>
            <h1 className="text-2xl font-semibold text-text-primary mt-0.5">Reports</h1>
          </div>
          <CalendarPicker mode={mode} cursor={cursor} onSelect={setCursor} />
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-1 bg-surface-card border border-surface-border rounded-pill p-1">
          {VIEW_MODES.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSetMode(opt.id)}
              className={`flex-1 font-mono text-xs tracking-wider px-3 py-1.5 rounded-pill transition-colors ${
                mode === opt.id ? 'bg-accent text-surface font-medium' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date strip — swipeable */}
        <div className="bg-surface-card border border-surface-border rounded-card p-3" {...swipe}>
          {mode === 'day'   && <DayStrip   cursor={cursor} onSelect={setCursor} sessions={sessions} />}
          {mode === 'week'  && <WeekStrip  cursor={cursor} onSelect={setCursor} />}
          {mode === 'month' && <MonthStrip cursor={cursor} onSelect={setCursor} />}
          {mode === 'year'  && <YearStrip  cursor={cursor} onSelect={setCursor} />}
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-6" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}>

        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16">
            <TrendingUp size={40} className="text-text-muted opacity-30" />
            <p className="text-text-muted text-sm max-w-[240px]">
              No sessions for this period. Clock in from the Task tab to generate a report.
            </p>
          </div>
        ) : (
          <>
            <PeriodSummary summary={summary} />

            {/* Time stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-card border border-surface-border rounded-card p-4 flex flex-col gap-1">
                <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-1">Time Tracked</p>
                <p className="font-mono text-2xl font-medium text-text-primary leading-none">
                  {totalHours.toFixed(2)}<span className="text-xs text-text-muted ml-1">hrs</span>
                </p>
                <p className="text-xs text-text-muted">{periodSessions.length} session{periodSessions.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-surface-card border border-surface-border rounded-card p-4 flex flex-col gap-1">
                <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase mb-1">Daily Avg</p>
                <p className="font-mono text-2xl font-medium text-text-primary leading-none">
                  {avgHours.toFixed(2)}<span className="text-xs text-text-muted ml-1">hrs</span>
                </p>
                <p className="text-xs text-text-muted">per active day</p>
              </div>
            </div>

            <HoursBarChart
              data={chartData}
              title={
                mode === 'day'   ? 'Hours this week' :
                mode === 'week'  ? 'Weekly hours'    :
                mode === 'month' ? 'Monthly hours'   : 'Annual hours'
              }
            />

            <SessionLog sessions={periodSessions} timeFmt={timeFmt} />
          </>
        )}

        <p className="text-xs text-text-muted text-center px-4 pb-2">
          ⚠️ Estimates based on 2024 Revenue.ie rates. Not a substitute for official payroll.
        </p>
      </div>

      {/* ── FLOATING "GO TO TODAY" BUTTON ───────────────────────────── */}
      <div
        className={`
          fixed bottom-20 left-1/2 -translate-x-1/2 z-50
          transition-all duration-300 ease-out pointer-events-none
          ${isCurrent
            ? 'opacity-0 translate-y-3'
            : 'opacity-100 translate-y-0 pointer-events-auto'
          }
        `}
      >
        <button
          onClick={() => setCursor(new Date())}
          className="
            flex items-center gap-2 px-5 py-2.5
            bg-accent text-surface
            font-mono text-xs font-medium tracking-wider
            rounded-pill shadow-lg shadow-accent/30
            active:scale-95 transition-transform
          "
        >
          Go to Today
        </button>
      </div>

    </div>
  )
}
