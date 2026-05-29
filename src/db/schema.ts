/**
 * db/schema.ts
 * Cloudflare D1 schema definitions + lightweight client wrapper.
 *
 * In production the `db` object is injected via the Cloudflare Pages Function
 * env binding (env.DB). In development / offline mode we fall back to
 * IndexedDB through a thin compatibility shim so the app works fully offline.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * D1 SQL schema (run once via `wrangler d1 execute timeireland --file=schema.sql`)
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─── SQL Schema (keep in sync with wrangler migration files) ─────────────────

export const SQL_SCHEMA = /* sql */ `
-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#22c55e',
  hourly_rate REAL,
  client_name TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

-- Work sessions
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  start_time  TEXT NOT NULL,
  end_time    TEXT,
  shift_type  TEXT NOT NULL DEFAULT 'regular',
  note        TEXT NOT NULL DEFAULT '',
  project_id  TEXT REFERENCES projects(id),
  created_at  TEXT NOT NULL
);

-- Breaks within a session
CREATE TABLE IF NOT EXISTS breaks (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  start_time  TEXT NOT NULL,
  end_time    TEXT,
  is_paid     INTEGER NOT NULL DEFAULT 0
);

-- Payroll settings (single row, upserted)
CREATE TABLE IF NOT EXISTS payroll_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  hourly_rate         REAL NOT NULL DEFAULT 13.50,
  employment_type     TEXT NOT NULL DEFAULT 'full_time',
  tax_band            TEXT NOT NULL DEFAULT 'standard',
  personal_tax_credit REAL NOT NULL DEFAULT 1875,
  prsi_class          TEXT NOT NULL DEFAULT 'A1',
  usc_exempt          INTEGER NOT NULL DEFAULT 0
);
`

// ─── D1 binding type (matches Cloudflare Workers D1 API) ─────────────────────

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  exec(query: string): Promise<D1ExecResult>
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
}

export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  error?: string
  meta: { duration: number; rows_read: number; rows_written: number }
}

export interface D1ExecResult {
  count: number
  duration: number
}

// ─── App DB client ────────────────────────────────────────────────────────────

export type DbEnv = { DB: D1Database }

/**
 * Thin wrapper so pages / components never touch D1 directly.
 * Swap the underlying driver (D1 vs IndexedDB shim) without touching callers.
 */
export class AppDb {
  constructor(protected readonly db: D1Database) {}

  // ── Sessions ──────────────────────────────────────────────────────────────

  async getAllSessions() {
    return this.db
      .prepare('SELECT * FROM sessions ORDER BY start_time DESC')
      .all<Record<string, unknown>>()
  }

  async getSessionById(id: string) {
    return this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
  }

  async upsertSession(session: {
    id: string
    startTime: string
    endTime: string | null
    shiftType: string
    note: string
    projectId: string | null
  }) {
    return this.db
      .prepare(
        `INSERT INTO sessions (id, start_time, end_time, shift_type, note, project_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           end_time   = excluded.end_time,
           shift_type = excluded.shift_type,
           note       = excluded.note,
           project_id = excluded.project_id`
      )
      .bind(
        session.id,
        session.startTime,
        session.endTime,
        session.shiftType,
        session.note,
        session.projectId,
        new Date().toISOString()
      )
      .run()
  }

  // ── Breaks ────────────────────────────────────────────────────────────────

  async getBreaksForSession(sessionId: string) {
    return this.db
      .prepare('SELECT * FROM breaks WHERE session_id = ? ORDER BY start_time')
      .bind(sessionId)
      .all<Record<string, unknown>>()
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async getAllProjects() {
    return this.db
      .prepare('SELECT * FROM projects WHERE is_archived = 0 ORDER BY name')
      .all<Record<string, unknown>>()
  }

  // ── Payroll settings ──────────────────────────────────────────────────────

  async getPayrollSettings() {
    return this.db
      .prepare('SELECT * FROM payroll_settings WHERE id = 1')
      .first<Record<string, unknown>>()
  }

  async savePayrollSettings(settings: {
    hourlyRate: number
    employmentType: string
    taxBand: string
    personalTaxCredit: number
    prsiClass: string
    uscExempt: boolean
  }) {
    return this.db
      .prepare(
        `INSERT INTO payroll_settings
           (id, hourly_rate, employment_type, tax_band, personal_tax_credit, prsi_class, usc_exempt)
         VALUES (1, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           hourly_rate         = excluded.hourly_rate,
           employment_type     = excluded.employment_type,
           tax_band            = excluded.tax_band,
           personal_tax_credit = excluded.personal_tax_credit,
           prsi_class          = excluded.prsi_class,
           usc_exempt          = excluded.usc_exempt`
      )
      .bind(
        settings.hourlyRate,
        settings.employmentType,
        settings.taxBand,
        settings.personalTaxCredit,
        settings.prsiClass,
        settings.uscExempt ? 1 : 0
      )
      .run()
  }
}

// ─── Hourly rates & Public holidays (AppDb extension) ─────────────────────────
// These methods are added here to keep all D1 access centralised.
// Paste into the AppDb class body if you merge schema files.

export class AppDbExtended extends AppDb {
  // ── Hourly rates ────────────────────────────────────────────────────────────

  async getAllHourlyRates() {
    return this.db
      .prepare('SELECT * FROM hourly_rates ORDER BY sort_order, created_at')
      .all<Record<string, unknown>>()
  }

  async upsertHourlyRate(rate: {
    id: string
    title: string
    rate: number
    conditionText: string
    computesPerDay: boolean
    daysOfWeek: number[]
    priority: number
    maxHours: number | null
    sortOrder: number
  }) {
    return this.db
      .prepare(
        `INSERT INTO hourly_rates
           (id, title, rate, condition_text, computes_per_day,
            days_of_week, priority, max_hours, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title            = excluded.title,
           rate             = excluded.rate,
           condition_text   = excluded.condition_text,
           computes_per_day = excluded.computes_per_day,
           days_of_week     = excluded.days_of_week,
           priority         = excluded.priority,
           max_hours        = excluded.max_hours,
           sort_order       = excluded.sort_order`
      )
      .bind(
        rate.id,
        rate.title,
        rate.rate,
        rate.conditionText,
        rate.computesPerDay ? 1 : 0,
        JSON.stringify(rate.daysOfWeek),
        rate.priority,
        rate.maxHours,
        rate.sortOrder,
      )
      .run()
  }

  async deleteHourlyRate(id: string) {
    return this.db.prepare('DELETE FROM hourly_rates WHERE id = ?').bind(id).run()
  }

  // ── Public holidays ─────────────────────────────────────────────────────────

  async getAllPublicHolidays() {
    return this.db
      .prepare('SELECT * FROM public_holidays ORDER BY date')
      .all<Record<string, unknown>>()
  }

  async upsertPublicHoliday(holiday: { id: string; name: string; date: string }) {
    return this.db
      .prepare(
        `INSERT INTO public_holidays (id, name, date)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           date = excluded.date`
      )
      .bind(holiday.id, holiday.name, holiday.date)
      .run()
  }

  async deletePublicHoliday(id: string) {
    return this.db.prepare('DELETE FROM public_holidays WHERE id = ?').bind(id).run()
  }
}
