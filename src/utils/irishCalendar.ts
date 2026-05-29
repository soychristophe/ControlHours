/**
 * utils/irishCalendar.ts
 * Irish public (bank) holidays and working-day utilities.
 *
 * References:
 *  - Workplace Relations Commission (WRC) — Public Holidays 2024/2025
 *  - Organisation of Working Time Act 1997
 *
 * Rules:
 *  • If a bank holiday falls on a Saturday → usually no substitute (some employers give Friday)
 *  • If it falls on a Sunday → following Monday is the substitute
 *  • The day off entitlement is as per Section 21 of the OWT Act 1997
 */

export interface IrishBankHoliday {
  date:  string   // ISO 'YYYY-MM-DD'
  name:  string
  /** True when the calendar date is a Sunday and the Monday is the substitute */
  substituteMonday: boolean
}

// ─── Fixed holidays ───────────────────────────────────────────────────────────

function fixed(year: number, month: number, day: number, name: string): IrishBankHoliday {
  const d    = new Date(year, month - 1, day)
  const isSun = d.getDay() === 0  // 0 = Sunday
  return {
    date:  d.toISOString().slice(0, 10),
    name,
    substituteMonday: isSun,
  }
}

// ─── Easter calculation (Anonymous Gregorian algorithm) ───────────────────────

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ─── First Monday of a month ──────────────────────────────────────────────────

function firstMonday(year: number, month: number): Date {
  const d = new Date(year, month - 1, 1)
  const dow = d.getDay()  // 0=Sun,1=Mon,...
  const diff = dow === 1 ? 0 : dow === 0 ? 1 : 8 - dow
  d.setDate(1 + diff)
  return d
}

// ─── Bank holidays for a given year ──────────────────────────────────────────

export function irishBankHolidays(year: number): IrishBankHoliday[] {
  const easter     = easterSunday(year)
  const easterMon  = addDays(easter, 1)

  const holidays: IrishBankHoliday[] = [
    // New Year's Day
    fixed(year, 1, 1, "New Year's Day"),

    // St Brigid's Day — first Monday of February (from 2023)
    {
      date: firstMonday(year, 2).toISOString().slice(0, 10),
      name: "St Brigid's Day",
      substituteMonday: false,
    },

    // St Patrick's Day
    fixed(year, 3, 17, "St Patrick's Day"),

    // Easter Monday
    {
      date: easterMon.toISOString().slice(0, 10),
      name: 'Easter Monday',
      substituteMonday: false,
    },

    // May Bank Holiday — first Monday of May
    {
      date: firstMonday(year, 5).toISOString().slice(0, 10),
      name: 'May Bank Holiday',
      substituteMonday: false,
    },

    // June Bank Holiday — first Monday of June
    {
      date: firstMonday(year, 6).toISOString().slice(0, 10),
      name: 'June Bank Holiday',
      substituteMonday: false,
    },

    // August Bank Holiday — first Monday of August
    {
      date: firstMonday(year, 8).toISOString().slice(0, 10),
      name: 'August Bank Holiday',
      substituteMonday: false,
    },

    // October Bank Holiday — last Monday of October
    (() => {
      const d = new Date(year, 9, 31)         // Oct 31
      while (d.getDay() !== 1) d.setDate(d.getDate() - 1)  // walk back to Monday
      return { date: d.toISOString().slice(0, 10), name: 'October Bank Holiday', substituteMonday: false }
    })(),

    // Christmas Day
    fixed(year, 12, 25, 'Christmas Day'),

    // St Stephen's Day
    fixed(year, 12, 26, "St Stephen's Day"),
  ]

  // Sort by date
  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

const _cache = new Map<number, Map<string, IrishBankHoliday>>()

function getMap(year: number): Map<string, IrishBankHoliday> {
  if (!_cache.has(year)) {
    const map = new Map<string, IrishBankHoliday>()
    for (const h of irishBankHolidays(year)) map.set(h.date, h)
    _cache.set(year, map)
  }
  return _cache.get(year)!
}

/** Returns the bank holiday for a given date, or null */
export function getBankHoliday(date: Date): IrishBankHoliday | null {
  const key  = date.toISOString().slice(0, 10)
  const year = date.getFullYear()
  return getMap(year).get(key) ?? null
}

/** Returns true if the given date is an Irish bank holiday */
export function isBankHoliday(date: Date): boolean {
  return getBankHoliday(date) !== null
}

/** Returns true if the date is a Sunday */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

/**
 * Suggests the ShiftType for a given date.
 * Useful for auto-tagging new sessions.
 */
export function suggestShiftType(date: Date): 'bank_holiday' | 'sunday' | 'regular' {
  if (isBankHoliday(date)) return 'bank_holiday'
  if (isSunday(date))      return 'sunday'
  return 'regular'
}
