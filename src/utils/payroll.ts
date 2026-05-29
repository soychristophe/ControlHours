/**
 * utils/payroll.ts
 * Irish payroll calculations: PAYE, PRSI (employee), USC.
 *
 * References:
 *  - Revenue.ie 2024/2025 tax rates
 *  - DSP PRSI contribution tables
 *  - PRSI A1: 4.20% to 30 Sep 2025 → 4.35% from 1 Oct 2025
 *  - USC thresholds Finance Act 2023
 *
 * ⚠️  These are estimates for planning purposes only.
 *      Always consult a qualified accountant for official payroll.
 */

import type { IrishPayrollSettings, PayPeriodSummary, WorkSession } from '@/types'

// ─── PRSI rate helpers ────────────────────────────────────────────────────────

/**
 * Returns the correct PRSI employee rate for a given date.
 * A1: 4.20% until 30 Sep 2025, then 4.35% from 1 Oct 2025.
 */
export function prsiRateForDate(date: Date, prsiClass: IrishPayrollSettings['prsiClass']): number {
  if (prsiClass !== 'A1') return 0
  const cutoff = new Date('2025-10-01T00:00:00')
  return date >= cutoff ? 0.0435 : 0.042
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const RATES = {
  OVERTIME_MULTIPLIER:      1.5,
  SUNDAY_MULTIPLIER:        1.5,
  BANK_HOLIDAY_MULTIPLIER:  2.0,

  STANDARD_RATE_BAND_ANNUAL: 42000,  // single person
  STANDARD_RATE:             0.20,
  HIGHER_RATE:               0.40,

  // PRSI class A1 — rate depends on date, see prsiRateForDate()
  PRSI_THRESHOLD_WEEKLY:     352,    // below → class A2 (zero employee PRSI)
  PRSI_EMPLOYER_RATE:        0.1150,

  // USC 2024
  USC_1_CEILING:  12012,  rate1: 0.005,
  USC_2_CEILING:  25760,  rate2: 0.02,
  USC_3_CEILING:  70044,  rate3: 0.04,
  USC_HIGHER_RATE:         0.08,

  WEEKS_PER_YEAR:  52,
} as const

// ─── Working time helpers ────────────────────────────────────────────────────

/** Returns net worked minutes for a session (excluding unpaid breaks). */
export function netWorkedMinutes(session: WorkSession): number {
  const start = new Date(session.startTime).getTime()
  const end   = session.endTime ? new Date(session.endTime).getTime() : Date.now()

  const breakMinutes = session.breaks
    .filter((b) => !b.isPaid)
    .reduce((acc, b) => {
      const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now()
      return acc + (bEnd - new Date(b.startTime).getTime()) / 60_000
    }, 0)

  return Math.max(0, (end - start) / 60_000 - breakMinutes)
}

/** Converts minutes to decimal hours (rounded to nearest 0.25). */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 4) / 4
}

// ─── ISO week key ─────────────────────────────────────────────────────────────

/** Returns Monday-based ISO week string: "2026-W22" */
export function isoWeekKey(d: Date): string {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  const dayOfWeek = (r.getDay() + 6) % 7   // 0=Mon … 6=Sun
  r.setDate(r.getDate() - dayOfWeek + 3)    // nearest Thursday
  const yearStart = new Date(r.getFullYear(), 0, 4)
  const week = 1 + Math.round(
    ((r.getTime() - yearStart.getTime()) / 86_400_000 - 3 + (yearStart.getDay() + 6) % 7) / 7
  )
  return `${r.getFullYear()}-W${String(week).padStart(2, '0')}`
}

// ─── Gross pay ────────────────────────────────────────────────────────────────

export interface HourBreakdown {
  regularHours:      number
  overtimeHours:     number
  bankHolidayHours:  number
  sundayHours:       number
}

export function calculateGrossPay(
  hours: HourBreakdown,
  hourlyRate: number
): number {
  return (
    hours.regularHours     * hourlyRate * 1                             +
    hours.overtimeHours    * hourlyRate * RATES.OVERTIME_MULTIPLIER     +
    hours.bankHolidayHours * hourlyRate * RATES.BANK_HOLIDAY_MULTIPLIER +
    hours.sundayHours      * hourlyRate * RATES.SUNDAY_MULTIPLIER
  )
}

// ─── Weekly-contract hours logic ─────────────────────────────────────────────

/**
 * Given a list of sessions that already have shiftType set, apply the
 * 39-hour weekly contract cap to re-classify hours.
 *
 * Rules (when weeklyContractHours is enabled):
 *  • G Public Holiday hours are EXCLUDED from the weekly cap count.
 *  • Mon–Sat regular hours accumulate toward the cap.
 *  • Hours beyond the cap on Mon–Sat → G Overtime (×1.5).
 *  • On Sunday:
 *      - if total Mon–Sat < cap → hours up to the remaining gap → G Sunday (base)
 *      - hours beyond the remaining gap → G Sunday Overtime
 *  • If already ≥ cap before Sunday → all Sunday hours → G Sunday Overtime.
 *
 * Sessions are grouped by ISO week. Returns an updated HourBreakdown.
 */
export function applyWeeklyCapToHours(
  sessions: WorkSession[],
  weeklyContractHours: number
): HourBreakdown {
  // Group sessions by ISO week
  const byWeek = new Map<string, WorkSession[]>()
  for (const s of sessions) {
    const key = isoWeekKey(new Date(s.startTime))
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(s)
  }

  const totals: HourBreakdown = {
    regularHours: 0, overtimeHours: 0,
    bankHolidayHours: 0, sundayHours: 0,
  }

  for (const [, weekSessions] of byWeek) {
    // Sort Mon–Sat first, then Sunday last
    const sorted = [...weekSessions].sort((a, b) => {
      const da = new Date(a.startTime).getDay()
      const db = new Date(b.startTime).getDay()
      const oa = da === 0 ? 7 : da
      const ob = db === 0 ? 7 : db
      return oa - ob
    })

    let weeklyCountable = 0  // hours that count toward the cap (non-PH, non-Sunday)

    for (const s of sorted) {
      const h       = minutesToHours(netWorkedMinutes(s))
      const dayNum  = new Date(s.startTime).getDay()
      const isSun   = dayNum === 0

      // Bank holidays: always counted at their own rate, don't count toward cap
      if (s.shiftType === 'bank_holiday') {
        totals.bankHolidayHours += h
        continue
      }

      if (!isSun) {
        // Mon–Sat: regular until cap, then overtime
        const remaining = Math.max(0, weeklyContractHours - weeklyCountable)
        const regular   = Math.min(h, remaining)
        const overtime  = h - regular
        totals.regularHours  += regular
        totals.overtimeHours += overtime
        weeklyCountable += h
      } else {
        // Sunday: gap to cap = sunday-base, remainder = sunday-overtime
        const gap           = Math.max(0, weeklyContractHours - weeklyCountable)
        const sundayBase    = Math.min(h, gap)
        const sundayOvertime = h - sundayBase
        totals.sundayHours    += sundayBase
        totals.overtimeHours  += sundayOvertime   // Sunday OT goes into overtimeHours
        // Sunday hours do NOT count toward cap per the rules
      }
    }
  }

  return totals
}

// ─── USC ─────────────────────────────────────────────────────────────────────

export function calculateAnnualUSC(annualGross: number, exempt: boolean): number {
  if (exempt || annualGross <= 13000) return 0

  const { USC_1_CEILING: c1, USC_2_CEILING: c2, USC_3_CEILING: c3 } = RATES
  let usc = 0

  usc += Math.min(annualGross, c1) * RATES.rate1
  if (annualGross > c1) usc += (Math.min(annualGross, c2) - c1) * RATES.rate2
  if (annualGross > c2) usc += (Math.min(annualGross, c3) - c2) * RATES.rate3
  if (annualGross > c3) usc += (annualGross - c3) * RATES.USC_HIGHER_RATE

  return usc
}

// ─── PAYE ─────────────────────────────────────────────────────────────────────

export function calculateAnnualPAYE(
  annualGross: number,
  settings: IrishPayrollSettings
): number {
  const standardBand = RATES.STANDARD_RATE_BAND_ANNUAL
  const standardTax  = Math.min(annualGross, standardBand) * RATES.STANDARD_RATE
  const higherTax    =
    annualGross > standardBand
      ? (annualGross - standardBand) * RATES.HIGHER_RATE
      : 0
  const grossTax  = standardTax + higherTax
  const netPAYE   = Math.max(0, grossTax - settings.personalTaxCredit * 2)
  return netPAYE
}

// ─── PRSI ─────────────────────────────────────────────────────────────────────

export function calculateWeeklyPRSI(
  weeklyGross: number,
  referenceDate: Date,
  prsiClass: IrishPayrollSettings['prsiClass']
): number {
  if (weeklyGross < RATES.PRSI_THRESHOLD_WEEKLY) return 0
  return weeklyGross * prsiRateForDate(referenceDate, prsiClass)
}

// ─── Summary builder ─────────────────────────────────────────────────────────

export function buildPayPeriodSummary(
  sessions: WorkSession[],
  settings: IrishPayrollSettings,
  periodStart: Date,
  periodEnd: Date
): PayPeriodSummary {
  const inPeriod = sessions.filter((s) => {
    const d = new Date(s.startTime)
    return d >= periodStart && d <= periodEnd
  })

  let hours: HourBreakdown

  if (settings.weeklyContractHours && settings.weeklyContractHours > 0) {
    // Use weekly-cap logic
    hours = applyWeeklyCapToHours(inPeriod, settings.weeklyContractHours)
  } else {
    // Legacy: use shiftType as-is
    hours = {
      regularHours: 0, overtimeHours: 0,
      bankHolidayHours: 0, sundayHours: 0,
    }
    for (const session of inPeriod) {
      const h = minutesToHours(netWorkedMinutes(session))
      if (session.shiftType === 'overtime')       hours.overtimeHours     += h
      else if (session.shiftType === 'bank_holiday') hours.bankHolidayHours += h
      else if (session.shiftType === 'sunday')    hours.sundayHours       += h
      else                                        hours.regularHours      += h
    }
  }

  const grossPay     = calculateGrossPay(hours, settings.hourlyRate)
  const weeksInPeriod = Math.max(1,
    (periodEnd.getTime() - periodStart.getTime()) / (7 * 24 * 3600 * 1000)
  )
  const annualisedGross = (grossPay / weeksInPeriod) * RATES.WEEKS_PER_YEAR

  const annualPAYE  = calculateAnnualPAYE(annualisedGross, settings)
  const annualUSC   = calculateAnnualUSC(annualisedGross, settings.uscExempt)
  const weeklyPRSI  = calculateWeeklyPRSI(
    grossPay / weeksInPeriod,
    periodEnd,
    settings.prsiClass
  )

  const periodPAYE  = (annualPAYE / RATES.WEEKS_PER_YEAR) * weeksInPeriod
  const periodUSC   = (annualUSC  / RATES.WEEKS_PER_YEAR) * weeksInPeriod
  const periodPRSI  = weeklyPRSI * weeksInPeriod

  return {
    periodStart,
    periodEnd,
    ...hours,
    grossPay,
    estimatedPAYE:   periodPAYE,
    estimatedUSC:    periodUSC,
    estimatedPRSI:   periodPRSI,
    estimatedNetPay: grossPay - periodPAYE - periodUSC - periodPRSI,
  }
}
