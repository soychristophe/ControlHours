// ─── Enumerations ─────────────────────────────────────────────────────────────

export type TabId      = 'task' | 'timeline' | 'reports' | 'settings'
export type ShiftType  = 'regular' | 'overtime' | 'bank_holiday' | 'sunday'
export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed'
export type TimeFormat = '24h' | '12h'

// ─── Core domain models ───────────────────────────────────────────────────────

export interface WorkSession {
  id:        string
  startTime: Date
  endTime:   Date | null
  breaks:    Break[]
  shiftType: ShiftType
  note:      string
  projectId: string | null
}

export interface Break {
  id:        string
  startTime: Date
  endTime:   Date | null
  isPaid:    boolean
}

export interface Project {
  id:         string
  name:       string
  color:      string
  hourlyRate: number | null
  clientName: string | null
  isArchived: boolean
  createdAt:  Date
}

// ─── Hourly rates / tariffs ───────────────────────────────────────────────────

/**
 * Days of week as JS Date.getDay() values:
 *   0 = Sunday, 1 = Monday … 6 = Saturday
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface HourlyRate {
  id: string
  /** Display name, e.g. "G Standard" */
  title: string
  /** Gross rate in euros per hour */
  rate: number
  /** Human-readable condition / description */
  condition: string
  /**
   * true  → amount computed and shown per working day
   * false → settled at the end of the pay cycle
   */
  computesPerDay: boolean
  /**
   * Days of the week this rate applies (JS Date.getDay() values).
   * Empty array = applies every day.
   */
  daysOfWeek: DayOfWeek[]
  /**
   * Evaluation priority — lower number evaluated first.
   * First matching rate covers its maxHours, then next takes over.
   */
  priority: number
  /**
   * Maximum hours/day this rate covers.
   * null = unlimited (absorbs all remaining hours).
   */
  maxHours: number | null
}

// ─── Public holidays ──────────────────────────────────────────────────────────

export interface PublicHoliday {
  id:   string
  name: string
  /** Full date in YYYY-MM-DD format */
  date: string
}

// ─── Ireland-specific payroll ─────────────────────────────────────────────────

export interface IrishPayrollSettings {
  hourlyRate:           number
  employmentType:       'full_time' | 'part_time'
  taxBand:              'standard' | 'higher'
  personalTaxCredit:    number
  prsiClass:            'A1' | 'A2' | 'S1' | 'M'
  uscExempt:            boolean
  /**
   * Weekly contracted hours cap (e.g. 39).
   * When set, hours Mon–Sat beyond this threshold escalate to G Overtime.
   * On Sunday, any gap up to the cap becomes G Sunday, beyond = G Sunday Overtime.
   * null / 0 = cap disabled (legacy behaviour).
   */
  weeklyContractHours:  number | null
}

export interface PayPeriodSummary {
  periodStart:      Date
  periodEnd:        Date
  regularHours:     number
  overtimeHours:    number
  bankHolidayHours: number
  sundayHours:      number
  grossPay:         number
  estimatedPAYE:    number
  estimatedPRSI:    number
  estimatedUSC:     number
  estimatedNetPay:  number
}
