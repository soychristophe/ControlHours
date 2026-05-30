/**
 * utils/backup.ts
 * Export / Import local JSON backups — no server required.
 * Compatible with iCloud Drive, Google Drive, Files app on iOS/Android.
 */

import { useAppStore } from '@/store'
import type {
  WorkSession, Project,
  IrishPayrollSettings, HourlyRate, PublicHoliday,
} from '@/types'

// ─── Backup format ────────────────────────────────────────────────────────────

export interface BackupFile {
  version:         2
  appName:         'timeireland'
  exportedAt:      string           // ISO string
  profileName:     string
  sessions:        WorkSession[]
  projects:        Project[]
  payrollSettings: IrishPayrollSettings
  hourlyRates:     HourlyRate[]
  publicHolidays:  PublicHoliday[]
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportData(profileName: string): void {
  const state = useAppStore.getState()

  const backup: BackupFile = {
    version:         2,
    appName:         'timeireland',
    exportedAt:      new Date().toISOString(),
    profileName,
    sessions:        state.sessions,
    projects:        state.projects,
    payrollSettings: state.payrollSettings,
    hourlyRates:     state.hourlyRates,
    publicHolidays:  state.publicHolidays,
  }

  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const safe = profileName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const a = document.createElement('a')
  a.href     = url
  a.download = `timeireland-${safe}-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Import / validate ────────────────────────────────────────────────────────

export class BackupValidationError extends Error {}

export function validateBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') {
    throw new BackupValidationError('El archivo no es un JSON válido.')
  }
  const b = raw as Record<string, unknown>

  if (b.appName !== 'timeireland') {
    throw new BackupValidationError('Este archivo no pertenece a TimeIreland.')
  }
  if (b.version !== 1 && b.version !== 2) {
    throw new BackupValidationError(`Versión de backup desconocida: ${b.version}`)
  }
  if (!Array.isArray(b.sessions)) {
    throw new BackupValidationError('El archivo no contiene sesiones válidas.')
  }

  return b as unknown as BackupFile
}

export async function importData(file: File): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw    = JSON.parse(e.target?.result as string)
        const backup = validateBackup(raw)

        useAppStore.setState({
          sessions:        backup.sessions,
          projects:        backup.projects        ?? [],
          payrollSettings: backup.payrollSettings ?? useAppStore.getState().payrollSettings,
          hourlyRates:     backup.hourlyRates     ?? useAppStore.getState().hourlyRates,
          publicHolidays:  backup.publicHolidays  ?? useAppStore.getState().publicHolidays,
        })

        resolve(backup)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsText(file)
  })
}

// ─── Profile registry (localStorage) ─────────────────────────────────────────

export interface Profile {
  id:          string
  name:        string
  avatar:      string           // single emoji
  lastSaved:   string | null    // ISO string
  sessionCount: number
}

const PROFILES_KEY = 'timeireland-profiles'
const ACTIVE_KEY   = 'timeireland-active-profile'

export function getProfiles(): Profile[] {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveProfiles(profiles: Profile[]): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
}

export function getActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveProfileId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else    localStorage.removeItem(ACTIVE_KEY)
}

export function createProfile(name: string, avatar: string): Profile {
  const profile: Profile = {
    id:           `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    avatar,
    lastSaved:    null,
    sessionCount: 0,
  }
  const profiles = [...getProfiles(), profile]
  saveProfiles(profiles)
  return profile
}

export function updateProfile(id: string, patch: Partial<Profile>): void {
  const profiles = getProfiles().map((p) => p.id === id ? { ...p, ...patch } : p)
  saveProfiles(profiles)
}

export function deleteProfile(id: string): void {
  const profiles = getProfiles().filter((p) => p.id !== id)
  saveProfiles(profiles)
  if (getActiveProfileId() === id) setActiveProfileId(null)
}

/** Snapshot current store state into the profile registry (no file download). */
export function snapshotProfile(profileId: string): void {
  const state = useAppStore.getState()
  updateProfile(profileId, {
    lastSaved:    new Date().toISOString(),
    sessionCount: state.sessions.length,
  })
}
