/**
 * pages/SettingsPage.tsx
 * Display · Payroll · Price per Hour · Public Holidays · App Info
 */

import { useState, useRef, useEffect } from 'react'
import {
  Save, Info, Shield, Clock,
  ChevronDown, ChevronUp,
  Plus, Pencil, Trash2,
  CalendarDays, RefreshCw,
  Euro, RotateCcw, Check, X,
  ArrowUpDown,
} from 'lucide-react'
import { useAppStore }  from '@/store'
import { SyncBadge }    from '@/components/SyncBadge'
import { useToast }     from '@/components/Toast'
import { useSync }        from '@/hooks/useSync'
import { BackupSection } from '@/components/BackupSection'
import type {
  IrishPayrollSettings, TimeFormat,
  HourlyRate, PublicHoliday, DayOfWeek,
} from '@/types'

// ─── Day-of-week helpers ──────────────────────────────────────────────────────

const WEEK_DAYS: { index: DayOfWeek; label: string; full: string }[] = [
  { index: 1, label: 'M', full: 'Monday'    },
  { index: 2, label: 'T', full: 'Tuesday'   },
  { index: 3, label: 'W', full: 'Wednesday' },
  { index: 4, label: 'T', full: 'Thursday'  },
  { index: 5, label: 'F', full: 'Friday'    },
  { index: 6, label: 'S', full: 'Saturday'  },
  { index: 0, label: 'S', full: 'Sunday'    },
]

function DayPills({
  selected, onChange, size = 'md',
}: {
  selected: DayOfWeek[]
  onChange?: (days: DayOfWeek[]) => void
  size?: 'sm' | 'md'
}) {
  function toggle(idx: DayOfWeek) {
    if (!onChange) return
    onChange(
      selected.includes(idx)
        ? selected.filter((d) => d !== idx)
        : [...selected, idx]
    )
  }
  const dim = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  return (
    <div className="flex items-center gap-1">
      {WEEK_DAYS.map(({ index, label, full }) => {
        const active = selected.includes(index)
        return (
          <button
            key={index} type="button" title={full}
            onClick={() => toggle(index)}
            disabled={!onChange}
            className={`
              ${dim} rounded-full font-mono font-semibold flex items-center justify-center
              border transition-all duration-150 select-none
              ${active
                ? 'bg-accent text-surface border-accent shadow-[0_0_8px_rgba(34,197,94,0.3)]'
                : onChange
                  ? 'bg-surface border-surface-border text-text-muted hover:border-accent/40 hover:text-text-secondary'
                  : 'bg-surface border-surface-border text-text-muted opacity-40'
              }
            `}
          >{label}</button>
        )
      })}
    </div>
  )
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase px-1 mt-2">
      {children}
    </p>
  )
}

function FieldRow({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-surface-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary font-medium">{label}</p>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function SelectPill<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-surface border border-surface-border rounded-pill p-0.5">
      {options.map((opt) => (
        <button key={opt.id} onClick={() => onChange(opt.id)}
          className={`font-mono text-xs px-2.5 py-1 rounded-pill transition-colors whitespace-nowrap
            ${value === opt.id ? 'bg-accent text-surface font-medium' : 'text-text-muted hover:text-text-secondary'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} role="switch" aria-checked={value}
      className={`relative w-12 h-6 rounded-full border transition-colors duration-200
        ${value ? 'bg-accent border-accent' : 'bg-surface border-surface-border'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
        ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
      <span className="text-text-muted">{icon}</span>
      <p className="flex-1 text-sm text-text-secondary">{label}</p>
      <p className="text-sm text-text-muted font-mono">{value}</p>
    </div>
  )
}

function CycleIcon({ computesPerDay }: { computesPerDay: boolean }) {
  return computesPerDay ? (
    <span title="Se computa por día"
      className="flex items-center gap-1 text-[10px] font-mono text-accent/80 bg-accent/10 border border-accent/20 rounded-pill px-1.5 py-0.5 whitespace-nowrap">
      <CalendarDays size={9} />día
    </span>
  ) : (
    <span title="Se liquida al final del ciclo"
      className="flex items-center gap-1 text-[10px] font-mono text-amber-hr/80 bg-amber-hrDim/30 border border-amber-hr/20 rounded-pill px-1.5 py-0.5 whitespace-nowrap">
      <RefreshCw size={9} />ciclo
    </span>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span title={`Prioridad ${priority} — menor número, mayor precedencia`}
      className="flex items-center gap-1 text-[10px] font-mono text-text-muted bg-surface border border-surface-border rounded-pill px-1.5 py-0.5 whitespace-nowrap">
      <ArrowUpDown size={8} />P{priority}
    </span>
  )
}

// ─── Accordion ────────────────────────────────────────────────────────────────

function Accordion({ title, badge, children, defaultOpen = false }: {
  title: string; badge?: number; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-surface-card border border-surface-border rounded-card">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-4 gap-3 hover:bg-surface-raised/50 transition-colors">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          {badge !== undefined && (
            <span className="font-mono text-[10px] bg-surface border border-surface-border text-text-muted rounded-pill px-1.5 py-0.5">
              {badge}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={16} className="text-text-muted shrink-0" />
          : <ChevronDown size={16} className="text-text-muted shrink-0" />}
      </button>
      {open && <div className="border-t border-surface-border">{children}</div>}
    </div>
  )
}

// ─── Rate form ────────────────────────────────────────────────────────────────

type RateFormState = Omit<HourlyRate, 'id'>

const EMPTY_RATE: RateFormState = {
  title: '', rate: 0, condition: '',
  computesPerDay: true,
  daysOfWeek: [1, 2, 3, 4, 5],
  priority: 1, maxHours: null,
}

function RateForm({ initial, onSave, onCancel }: {
  initial: RateFormState
  onSave:  (r: RateFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<RateFormState>(initial)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  const valid = form.title.trim().length > 0 && form.rate > 0
  function patch<K extends keyof RateFormState>(k: K, v: RateFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }))
  }

  return (
    <div className="px-4 py-5 flex flex-col gap-4 bg-surface/60">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Título</label>
        <input ref={titleRef} value={form.title}
          onChange={(e) => patch('title', e.target.value)}
          placeholder="ej. G Standard"
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 font-medium" />
      </div>

      {/* Rate + Priority */}
      <div className="flex gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Importe (€/hr)</label>
          <div className="relative">
            <Euro size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="number" min={0} step={0.01}
              value={form.rate === 0 ? '' : form.rate}
              onChange={(e) => patch('rate', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full bg-surface border border-surface-border rounded-lg pl-7 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 font-mono" />
          </div>
        </div>
        <div className="w-24 flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase"
            title="Menor número = mayor prioridad">Prioridad</label>
          <div className="relative">
            <ArrowUpDown size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="number" min={0} max={99} step={1}
              value={form.priority}
              onChange={(e) => patch('priority', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-surface border border-surface-border rounded-lg pl-7 pr-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/60 font-mono text-center" />
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Condición</label>
        <input value={form.condition}
          onChange={(e) => patch('condition', e.target.value)}
          placeholder="Cuándo aplica esta tarifa"
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60" />
      </div>

      {/* Days of week */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Días aplicables</label>
          <div className="flex gap-2 text-[10px] font-mono">
            <button type="button" onClick={() => patch('daysOfWeek', [1,2,3,4,5,6,0])}
              className="text-text-muted hover:text-accent transition-colors">todos</button>
            <span className="text-text-muted">·</span>
            <button type="button" onClick={() => patch('daysOfWeek', [1,2,3,4,5])}
              className="text-text-muted hover:text-accent transition-colors">L–V</button>
            <span className="text-text-muted">·</span>
            <button type="button" onClick={() => patch('daysOfWeek', [])}
              className="text-text-muted hover:text-danger transition-colors">ninguno</button>
          </div>
        </div>
        <DayPills selected={form.daysOfWeek}
          onChange={(days) => patch('daysOfWeek', days as DayOfWeek[])} />
        {form.daysOfWeek.length === 0 && (
          <p className="text-[10px] text-amber-hr font-mono">⚠ Sin días — la tarifa nunca aplicará</p>
        )}
      </div>

      {/* Max hours + Computes per day */}
      <div className="flex gap-3 items-start">
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase"
            title="Vacío = sin límite">Máx. horas/día</label>
          <div className="relative">
            <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input type="number" min={0} max={24} step={0.5}
              value={form.maxHours ?? ''}
              onChange={(e) => {
                const v = e.target.value
                patch('maxHours', v === '' ? null : parseFloat(v) || null)
              }}
              placeholder="Sin límite"
              className="w-full bg-surface border border-surface-border rounded-lg pl-7 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 font-mono" />
          </div>
          <p className="text-[10px] text-text-muted leading-relaxed">
            {form.maxHours
              ? `Cubre las primeras ${form.maxHours}h; el resto → siguiente tarifa.`
              : 'Sin límite — absorbe todas las horas restantes.'}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 items-start pt-0.5">
          <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Por día</label>
          <Toggle value={form.computesPerDay} onChange={(v) => patch('computesPerDay', v)} />
          <p className="text-[10px] text-text-muted max-w-[72px] leading-tight">
            {form.computesPerDay ? 'día a día' : 'fin ciclo'}
          </p>
        </div>
      </div>

      {/* Priority hint */}
      <div className="bg-surface border border-surface-border rounded-lg px-3 py-2.5 flex gap-2">
        <ArrowUpDown size={13} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-[11px] text-text-muted leading-relaxed">
          <span className="text-text-secondary font-medium">Prioridad {form.priority}</span>
          {' '}— evaluadas de menor a mayor.
          {form.maxHours
            ? ` Esta cubre hasta ${form.maxHours}h; la siguiente toma el relevo.`
            : ' Al no tener límite, absorbe todas las horas restantes del día.'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-surface font-semibold text-sm rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform">
          <Check size={14} />Guardar tarifa
        </button>
        <button onClick={onCancel}
          className="flex items-center justify-center gap-1.5 border border-surface-border text-text-muted text-sm rounded-lg px-4 py-2.5 hover:text-text-secondary transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Rate row ─────────────────────────────────────────────────────────────────

function RateRow({ rate, onEdit, onDelete }: {
  rate: HourlyRate; onEdit: () => void; onDelete: () => void
}) {
  return (
    <div className="px-4 pt-3.5 pb-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold text-text-primary">{rate.title}</p>
            <PriorityBadge priority={rate.priority} />
            <CycleIcon computesPerDay={rate.computesPerDay} />
            {rate.maxHours !== null && (
              <span title={`Máximo ${rate.maxHours}h por día`}
                className="flex items-center gap-1 text-[10px] font-mono text-text-muted bg-surface border border-surface-border rounded-pill px-1.5 py-0.5 whitespace-nowrap">
                <Clock size={8} />{rate.maxHours}h
              </span>
            )}
          </div>
          {rate.condition && (
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{rate.condition}</p>
          )}
        </div>
        <div className="shrink-0 text-right ml-2">
          <p className="font-mono text-sm font-bold text-accent">€{rate.rate.toFixed(2)}</p>
          <p className="font-mono text-[10px] text-text-muted">/hr</p>
        </div>
        <div className="shrink-0 flex items-center gap-0.5 ml-1">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors" title="Editar">
            <Pencil size={13} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="mt-2.5">
        <DayPills selected={rate.daysOfWeek} size="sm" />
      </div>
    </div>
  )
}

// ─── Hourly rates section ─────────────────────────────────────────────────────

function HourlyRatesSection() {
  const rates      = useAppStore((s) => s.hourlyRates)
  const addRate    = useAppStore((s) => s.addHourlyRate)
  const updateRate = useAppStore((s) => s.updateHourlyRate)
  const deleteRate = useAppStore((s) => s.deleteHourlyRate)
  const resetRates = useAppStore((s) => s.resetHourlyRates)
  const toast      = useToast()

  const [editing, setEditing] = useState<string | null>(null)

  function handleSave(id: string | 'new', form: RateFormState) {
    if (id === 'new') { addRate(form); toast.success('Tarifa añadida') }
    else              { updateRate(id, form); toast.success('Tarifa actualizada') }
    setEditing(null)
  }

  const sorted = [...rates].sort((a, b) => a.priority - b.priority)

  return (
    <Accordion title="Price per Hour" badge={rates.length} defaultOpen>
      <div>
        {sorted.map((rate, idx) => (
          <div key={rate.id}
            className={idx < sorted.length - 1 ? 'border-b border-surface-border' : ''}>
            {editing === rate.id ? (
              <RateForm
                initial={{ title: rate.title, rate: rate.rate, condition: rate.condition,
                           computesPerDay: rate.computesPerDay, daysOfWeek: rate.daysOfWeek,
                           priority: rate.priority, maxHours: rate.maxHours }}
                onSave={(form) => handleSave(rate.id, form)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <RateRow rate={rate}
                onEdit={() => setEditing(rate.id)}
                onDelete={() => { deleteRate(rate.id); toast.info(`"${rate.title}" eliminada`) }}
              />
            )}
          </div>
        ))}

        <div className="border-t border-surface-border">
          {editing === 'new' ? (
            <RateForm initial={EMPTY_RATE}
              onSave={(form) => handleSave('new', form)}
              onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <button onClick={() => setEditing('new')}
                className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-glow font-medium transition-colors">
                <Plus size={15} />Añadir tarifa
              </button>
              <button onClick={() => { resetRates(); setEditing(null); toast.info('Tarifas restablecidas') }}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors">
                <RotateCcw size={11} />Reset
              </button>
            </div>
          )}
        </div>

        {!editing && rates.length > 1 && (
          <div className="px-4 py-2.5 border-t border-surface-border bg-surface/40">
            <p className="text-[10px] text-text-muted font-mono leading-relaxed">
              <ArrowUpDown size={9} className="inline mr-1 opacity-60" />
              Evaluación por prioridad ascendente. Una tarifa cubre sus horas máx. y la siguiente toma el relevo.
            </p>
          </div>
        )}
      </div>
    </Accordion>
  )
}

// ─── Public holidays section ──────────────────────────────────────────────────

type HolidayFormState = Omit<PublicHoliday, 'id'>

const EMPTY_HOLIDAY: HolidayFormState = { name: '', date: '' }

function HolidayForm({ initial, onSave, onCancel }: {
  initial: HolidayFormState
  onSave:  (h: HolidayFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<HolidayFormState>(initial)
  const nameRef = useRef<HTMLInputElement>(null)
  useEffect(() => { nameRef.current?.focus() }, [])

  const valid = form.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(form.date)

  return (
    <div className="px-4 py-4 flex flex-col gap-3 bg-surface/60">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Nombre del festivo</label>
        <input ref={nameRef} value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="ej. Christmas Day"
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60 font-medium" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] tracking-widest text-text-muted uppercase">Fecha</label>
        <input type="date" value={form.date}
          onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/60 font-mono [color-scheme:dark]" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          className="flex-1 flex items-center justify-center gap-1.5 bg-accent text-surface font-semibold text-sm rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform">
          <Check size={14} />Guardar
        </button>
        <button onClick={onCancel}
          className="flex items-center justify-center gap-1.5 border border-surface-border text-text-muted text-sm rounded-lg px-4 py-2.5 hover:text-text-secondary transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

function fmtDate(iso: string): string {
  try { return new Date(iso + 'T12:00:00').toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function PublicHolidaysSection() {
  const holidays      = useAppStore((s) => s.publicHolidays)
  const addHoliday    = useAppStore((s) => s.addPublicHoliday)
  const updateHoliday = useAppStore((s) => s.updatePublicHoliday)
  const deleteHoliday = useAppStore((s) => s.deletePublicHoliday)
  const resetHolidays = useAppStore((s) => s.resetPublicHolidays)
  const toast         = useToast()

  const [editing, setEditing] = useState<string | null>(null)

  function handleSave(id: string | 'new', form: HolidayFormState) {
    if (id === 'new') { addHoliday(form); toast.success('Festivo añadido') }
    else              { updateHoliday(id, form); toast.success('Festivo actualizado') }
    setEditing(null)
  }

  return (
    <Accordion title="Public Holidays" badge={holidays.length} defaultOpen>
      <div className="divide-y divide-surface-border">
        {holidays.map((h) => (
          <div key={h.id}>
            {editing === h.id ? (
              <HolidayForm initial={{ name: h.name, date: h.date }}
                onSave={(form) => handleSave(h.id, form)}
                onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="shrink-0 w-14 text-center">
                  <p className="font-mono text-xs font-bold text-accent leading-none">
                    {h.date.slice(5, 7)}/{h.date.slice(8, 10)}
                  </p>
                  <p className="font-mono text-[10px] text-text-muted mt-0.5">{h.date.slice(0, 4)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary font-medium truncate">{h.name}</p>
                  <p className="text-xs text-text-muted">{fmtDate(h.date)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button onClick={() => setEditing(h.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => { deleteHoliday(h.id); toast.info(`"${h.name}" eliminado`) }}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {editing === 'new' ? (
          <HolidayForm initial={EMPTY_HOLIDAY}
            onSave={(form) => handleSave('new', form)}
            onCancel={() => setEditing(null)} />
        ) : (
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <button onClick={() => setEditing('new')}
              className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-glow font-medium transition-colors">
              <Plus size={15} />Añadir festivo
            </button>
            <button onClick={() => { resetHolidays(); toast.info('Festivos restablecidos') }}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors">
              <RotateCcw size={11} />Reset
            </button>
          </div>
        )}
      </div>
    </Accordion>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SettingsPage({ onSwitchProfile }: { onSwitchProfile?: () => void }) {
  const savedSettings  = useAppStore((s) => s.payrollSettings)
  const updateSettings = useAppStore((s) => s.updatePayrollSettings)
  const timeFormat     = useAppStore((s) => s.timeFormat)
  const setTimeFormat  = useAppStore((s) => s.setTimeFormat)
  const lastSyncedAt   = useAppStore((s) => s.lastSyncedAt)
  const { syncNow }    = useSync()
  const toast          = useToast()

  const [draft, setDraft] = useState<IrishPayrollSettings>({ ...savedSettings })
  const [saved, setSaved] = useState(false)
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedSettings)

  function patch<K extends keyof IrishPayrollSettings>(key: K, value: IrishPayrollSettings[K]) {
    setDraft((p) => ({ ...p, [key]: value })); setSaved(false)
  }

  function handleSave() {
    updateSettings(draft); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    toast.success('Settings saved')
    syncNow()
  }

  const fmtSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
    : 'Never'

  return (
    <div className="flex flex-col min-h-full px-4 pt-8 pb-6 gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-text-muted tracking-widest uppercase">Preferences</p>
          <h1 className="text-2xl font-semibold text-text-primary mt-0.5">Settings</h1>
        </div>
        <SyncBadge />
      </div>

      {/* ── Display ── */}
      <SectionTitle>Display</SectionTitle>
      <div className="bg-surface-card border border-surface-border rounded-card px-4">
        <FieldRow label="Time Format" hint="Applies to all clocks and session labels">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-text-muted" />
            <SelectPill<TimeFormat>
              value={timeFormat}
              options={[{ id: '24h', label: '24h' }, { id: '12h', label: 'AM/PM' }]}
              onChange={setTimeFormat}
            />
          </div>
        </FieldRow>
      </div>

      {/* ── Payroll ── */}
      <SectionTitle>Payroll</SectionTitle>
      <div className="bg-surface-card border border-surface-border rounded-card px-4">
        <FieldRow label="Hourly Rate" hint="Ireland minimum wage 2024: €13.50/hr">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted font-mono text-sm">€</span>
            <input type="number" min={13.50} step={0.50} value={draft.hourlyRate}
              onChange={(e) => patch('hourlyRate', parseFloat(e.target.value) || 13.50)}
              className="w-20 text-right bg-surface border border-surface-border rounded-lg px-2 py-1.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent/60" />
          </div>
        </FieldRow>
        <FieldRow label="Employment Type">
          <SelectPill value={draft.employmentType}
            options={[{ id: 'full_time', label: 'Full' }, { id: 'part_time', label: 'Part' }]}
            onChange={(v) => patch('employmentType', v)} />
        </FieldRow>
        <FieldRow label="Tax Band" hint="Standard: up to €42,000 · Higher: above">
          <SelectPill value={draft.taxBand}
            options={[{ id: 'standard', label: '20%' }, { id: 'higher', label: '40%' }]}
            onChange={(v) => patch('taxBand', v)} />
        </FieldRow>
        <FieldRow label="Personal Tax Credit" hint="Default €1,875 (single). Married: €3,750">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted font-mono text-sm">€</span>
            <input type="number" min={0} step={100} value={draft.personalTaxCredit}
              onChange={(e) => patch('personalTaxCredit', parseFloat(e.target.value) || 1875)}
              className="w-24 text-right bg-surface border border-surface-border rounded-lg px-2 py-1.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent/60" />
          </div>
        </FieldRow>
        <FieldRow label="PRSI Class" hint="A1: 4.20% until Oct 2025 · 4.35% from Oct 2025">
          <SelectPill value={draft.prsiClass}
            options={[{ id: 'A1', label: 'A1' }, { id: 'A2', label: 'A2' }, { id: 'S1', label: 'S1' }, { id: 'M', label: 'M' }]}
            onChange={(v) => patch('prsiClass', v)} />
        </FieldRow>
        <FieldRow label="USC Exempt" hint="Exempt if annual income ≤ €13,000">
          <Toggle value={draft.uscExempt} onChange={(v) => patch('uscExempt', v)} />
        </FieldRow>
        <FieldRow
          label="Weekly Contract Hours"
          hint={
            draft.weeklyContractHours
              ? `Cap: ${draft.weeklyContractHours}h · Mon–Sat excess → G Overtime · Sunday gap → G Sunday / G Sunday OT`
              : 'Disabled — enable to apply 39h weekly cap logic'
          }
        >
          <div className="flex items-center gap-2">
            <Toggle
              value={draft.weeklyContractHours !== null && draft.weeklyContractHours > 0}
              onChange={(v) => patch('weeklyContractHours', v ? 39 : null)}
            />
            {draft.weeklyContractHours !== null && draft.weeklyContractHours > 0 && (
              <div className="flex items-center gap-1">
                <input
                  type="number" min={1} max={80} step={1}
                  value={draft.weeklyContractHours}
                  onChange={(e) => patch('weeklyContractHours', parseInt(e.target.value) || 39)}
                  className="w-16 text-right bg-surface border border-surface-border rounded-lg px-2 py-1.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent/60"
                />
                <span className="text-xs text-text-muted font-mono">h</span>
              </div>
            )}
          </div>
        </FieldRow>
      </div>

      {isDirty && (
        <button onClick={handleSave}
          className="flex items-center justify-center gap-2 bg-accent text-surface font-semibold text-base rounded-card py-3.5 active:scale-95 transition-transform">
          <Save size={18} />Save Changes
        </button>
      )}
      {saved && !isDirty && (
        <p className="text-center text-accent text-sm font-mono">✓ Saved</p>
      )}

      {/* ── Tariffs ── */}
      <SectionTitle>Tariffs</SectionTitle>
      <HourlyRatesSection />

      {/* ── Holidays ── */}
      <SectionTitle>Holidays</SectionTitle>
      <PublicHolidaysSection />

      {/* ── Backup & profiles ── */}
      <BackupSection onSwitchProfile={() => onSwitchProfile?.()} />

      {/* ── App info ── */}
      <SectionTitle>App Info</SectionTitle>
      <div className="bg-surface-card border border-surface-border rounded-card px-4">
        <InfoRow icon={<Info size={16} />}   label="Version"      value="0.1.0" />
        <InfoRow icon={<Shield size={16} />} label="Data storage" value="IndexedDB + D1" />
        <InfoRow icon={<Info size={16} />}   label="Last synced"  value={fmtSync} />
      </div>

      <p className="text-xs text-text-muted text-center px-4">
        Tax calculations are estimates based on Revenue.ie 2024 rates.
        Always verify with your employer or a qualified accountant.
      </p>
    </div>
  )
}
