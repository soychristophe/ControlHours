/**
 * store/index.ts
 * Global Zustand store — offline-first, persisted to localStorage.
 */

import { create } from 'zustand'
import {
  idbUpsertSession, idbDeleteSession,
  idbUpsertProject,
  idbSaveSettings,
} from '@/db/offline'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  TabId, WorkSession, Project,
  IrishPayrollSettings, TimeFormat,
  HourlyRate, PublicHoliday,
} from '@/types'

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PAYROLL: IrishPayrollSettings = {
  hourlyRate:           13.50,
  employmentType:       'full_time',
  taxBand:              'standard',
  personalTaxCredit:    1875,
  prsiClass:            'A1',
  uscExempt:            false,
  weeklyContractHours:  null,
}

export const DEFAULT_HOURLY_RATES: HourlyRate[] = [
  {
    id: 'g-standard',
    title: 'G Standard',
    rate: 14.25,
    condition: 'Hora ordinaria. Días laborables y sábados',
    computesPerDay: true,
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    priority: 1,
    maxHours: 8,
  },
  {
    id: 'g-sunday',
    title: 'G Sunday',
    rate: 17.10,
    condition: 'Hora de domingo base (jornada estándar)',
    computesPerDay: true,
    daysOfWeek: [0],
    priority: 1,
    maxHours: 8,
  },
  {
    id: 'g-overtime',
    title: 'G Overtime',
    rate: 21.38,
    condition: 'Horas extra ordinarias ×1.5 en días laborables',
    computesPerDay: true,
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    priority: 2,
    maxHours: null,
  },
  {
    id: 'g-sunday-overtime',
    title: 'G Sunday Overtime',
    rate: 24.23,
    condition: 'Horas extra realizadas en domingo',
    computesPerDay: true,
    daysOfWeek: [0],
    priority: 2,
    maxHours: null,
  },
  {
    id: 'g-public-holiday',
    title: 'G Public Holiday',
    rate: 28.50,
    condition: 'Festivos oficiales. Doble del G Standard del día (×2)',
    computesPerDay: false,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    priority: 0,
    maxHours: null,
  },
]

export const DEFAULT_PUBLIC_HOLIDAYS: PublicHoliday[] = [
  { id: 'ph-01', name: "New Year's Day",       date: '2026-01-01' },
  { id: 'ph-02', name: "St Brigid's Day",       date: '2026-02-02' },
  { id: 'ph-03', name: "St Patrick's Day",      date: '2026-03-17' },
  { id: 'ph-04', name: 'Easter Monday',         date: '2026-04-06' },
  { id: 'ph-05', name: 'May Day',               date: '2026-05-04' },
  { id: 'ph-06', name: 'June Bank Holiday',     date: '2026-06-01' },
  { id: 'ph-07', name: 'August Bank Holiday',   date: '2026-08-03' },
  { id: 'ph-08', name: 'October Bank Holiday',  date: '2026-10-26' },
  { id: 'ph-09', name: 'Christmas Day',         date: '2026-12-25' },
  { id: 'ph-10', name: "St Stephen's Day",      date: '2026-12-26' },
]

// ─── Store interface ──────────────────────────────────────────────────────────

interface AppStore {
  // ── Navigation ──────────────────────────────────────────────────────────────
  activeTab:    TabId
  setActiveTab: (tab: TabId) => void

  // ── Display ──────────────────────────────────────────────────────────────────
  timeFormat:    TimeFormat
  setTimeFormat: (fmt: TimeFormat) => void

  // ── Sessions ─────────────────────────────────────────────────────────────────
  currentSession: WorkSession | null
  sessions:       WorkSession[]
  startSession:      () => void
  stopSession:       () => void
  updateSessionNote: (id: string, note: string) => void
  /** Full update of any session field (handles both live and completed) */
  updateSession:     (id: string, updates: Partial<Omit<WorkSession, 'id'>>) => void
  addManualSession:  (session: Omit<WorkSession, 'id'>) => void
  deleteSession:     (id: string) => void

  // ── Projects ─────────────────────────────────────────────────────────────────
  projects:       Project[]
  addProject:     (project: Omit<Project, 'id' | 'createdAt'>) => void
  archiveProject: (id: string) => void

  // ── Payroll ──────────────────────────────────────────────────────────────────
  payrollSettings:       IrishPayrollSettings
  updatePayrollSettings: (settings: Partial<IrishPayrollSettings>) => void

  // ── Hourly rates / tariffs ────────────────────────────────────────────────────
  hourlyRates:      HourlyRate[]
  addHourlyRate:    (rate: Omit<HourlyRate, 'id'>) => void
  updateHourlyRate: (id: string, patch: Partial<Omit<HourlyRate, 'id'>>) => void
  deleteHourlyRate: (id: string) => void
  resetHourlyRates: () => void

  // ── Public holidays ───────────────────────────────────────────────────────────
  publicHolidays:      PublicHoliday[]
  addPublicHoliday:    (holiday: Omit<PublicHoliday, 'id'>) => void
  updatePublicHoliday: (id: string, patch: Partial<Omit<PublicHoliday, 'id'>>) => void
  deletePublicHoliday: (id: string) => void
  resetPublicHolidays: () => void

  // ── Sync ─────────────────────────────────────────────────────────────────────
  lastSyncedAt: Date | null
  isSyncing:    boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sortByStart(sessions: WorkSession[]): WorkSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Navigation ──────────────────────────────────────────────────────────
      activeTab:    'task',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // ── Display ─────────────────────────────────────────────────────────────
      timeFormat:    '24h',
      setTimeFormat: (fmt) => set({ timeFormat: fmt }),

      // ── Sessions ────────────────────────────────────────────────────────────
      currentSession: null,
      sessions:       [],

      startSession: () => set({
        currentSession: {
          id: genId(), startTime: new Date(), endTime: null,
          breaks: [], shiftType: 'regular', note: '', projectId: null,
        },
      }),

      stopSession: () => {
        const { currentSession, sessions } = get()
        if (!currentSession) return
        const completed = { ...currentSession, endTime: new Date() }
        set({
          currentSession: null,
          sessions: sortByStart([completed, ...sessions]),
        })
        idbUpsertSession(completed as unknown as Record<string, unknown>).catch(console.warn)
      },

      updateSessionNote: (id, note) => set((state) => {
        if (state.currentSession?.id === id)
          return { currentSession: { ...state.currentSession, note } }
        return { sessions: state.sessions.map((s) => s.id === id ? { ...s, note } : s) }
      }),

      updateSession: (id, updates) => set((state) => {
        if (state.currentSession?.id === id)
          return { currentSession: { ...state.currentSession, ...updates } }
        const updated = state.sessions.map((s) => s.id === id ? { ...s, ...updates } : s)
        const target = updated.find((s) => s.id === id)
        if (target) idbUpsertSession(target as unknown as Record<string, unknown>).catch(console.warn)
        return { sessions: sortByStart(updated) }
      }),

      addManualSession: (session) => set((state) => {
        const newSession = { ...session, id: genId() }
        idbUpsertSession(newSession as unknown as Record<string, unknown>).catch(console.warn)
        return { sessions: sortByStart([newSession, ...state.sessions]) }
      }),

      deleteSession: (id) => {
        idbDeleteSession(id).catch(console.warn)
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
      },

      // ── Projects ────────────────────────────────────────────────────────────
      projects: [],

      addProject: (project) => set((state) => {
        const newProject = { ...project, id: genId(), createdAt: new Date(), isArchived: false }
        idbUpsertProject(newProject as unknown as Record<string, unknown>).catch(console.warn)
        return { projects: [...state.projects, newProject] }
      }),

      archiveProject: (id) => set((state) => ({
        projects: state.projects.map((p) => p.id === id ? { ...p, isArchived: true } : p),
      })),

      // ── Payroll ─────────────────────────────────────────────────────────────
      payrollSettings:       DEFAULT_PAYROLL,
      updatePayrollSettings: (settings) => set((state) => {
        const merged = { ...state.payrollSettings, ...settings }
        idbSaveSettings(merged as unknown as Record<string, unknown>).catch(console.warn)
        return { payrollSettings: merged }
      }),

      // ── Hourly rates ─────────────────────────────────────────────────────────
      hourlyRates: DEFAULT_HOURLY_RATES,

      addHourlyRate: (rate) => set((state) => ({
        hourlyRates: [...state.hourlyRates, { ...rate, id: genId() }]
          .sort((a, b) => a.priority - b.priority),
      })),

      updateHourlyRate: (id, patch) => set((state) => ({
        hourlyRates: state.hourlyRates
          .map((r) => r.id === id ? { ...r, ...patch } : r)
          .sort((a, b) => a.priority - b.priority),
      })),

      deleteHourlyRate: (id) => set((state) => ({
        hourlyRates: state.hourlyRates.filter((r) => r.id !== id),
      })),

      resetHourlyRates: () => set({ hourlyRates: DEFAULT_HOURLY_RATES }),

      // ── Public holidays ──────────────────────────────────────────────────────
      publicHolidays: DEFAULT_PUBLIC_HOLIDAYS,

      addPublicHoliday: (holiday) => set((state) => ({
        publicHolidays: [...state.publicHolidays, { ...holiday, id: genId() }]
          .sort((a, b) => a.date.localeCompare(b.date)),
      })),

      updatePublicHoliday: (id, patch) => set((state) => ({
        publicHolidays: state.publicHolidays
          .map((h) => h.id === id ? { ...h, ...patch } : h)
          .sort((a, b) => a.date.localeCompare(b.date)),
      })),

      deletePublicHoliday: (id) => set((state) => ({
        publicHolidays: state.publicHolidays.filter((h) => h.id !== id),
      })),

      resetPublicHolidays: () => set({ publicHolidays: DEFAULT_PUBLIC_HOLIDAYS }),

      // ── Sync ─────────────────────────────────────────────────────────────────
      lastSyncedAt: null,
      isSyncing:    false,
    }),
    {
      name:    'timeireland-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessions:        state.sessions,
        projects:        state.projects,
        payrollSettings: state.payrollSettings,
        timeFormat:      state.timeFormat,
        hourlyRates:     state.hourlyRates,
        publicHolidays:  state.publicHolidays,
        lastSyncedAt:    state.lastSyncedAt,
      }),
    }
  )
)
