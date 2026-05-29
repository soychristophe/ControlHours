-- =============================================================================
-- TimeIreland — Cloudflare D1 schema
-- Run: npx wrangler d1 execute timeireland --file=src/db/schema.sql
-- =============================================================================

-- Projects ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  color         TEXT    NOT NULL DEFAULT '#22c55e',
  hourly_rate   REAL,
  client_name   TEXT,
  is_archived   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL
);

-- Work sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  start_time  TEXT    NOT NULL,
  end_time    TEXT,
  shift_type  TEXT    NOT NULL DEFAULT 'regular',
  note        TEXT    NOT NULL DEFAULT '',
  project_id  TEXT    REFERENCES projects(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time);

-- Breaks within a session ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS breaks (
  id          TEXT    PRIMARY KEY,
  session_id  TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  start_time  TEXT    NOT NULL,
  end_time    TEXT,
  is_paid     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_breaks_session ON breaks(session_id);

-- Payroll settings (single row, id always = 1) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1,
  hourly_rate         REAL    NOT NULL DEFAULT 13.50,
  employment_type     TEXT    NOT NULL DEFAULT 'full_time',
  tax_band            TEXT    NOT NULL DEFAULT 'standard',
  personal_tax_credit REAL    NOT NULL DEFAULT 1875,
  prsi_class          TEXT    NOT NULL DEFAULT 'A1',
  usc_exempt          INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Insert default payroll settings if not present ──────────────────────────────
INSERT OR IGNORE INTO payroll_settings (id) VALUES (1);

-- Hourly rates / tariffs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hourly_rates (
  id               TEXT    PRIMARY KEY,
  title            TEXT    NOT NULL,
  rate             REAL    NOT NULL,
  condition_text   TEXT    NOT NULL DEFAULT '',
  computes_per_day INTEGER NOT NULL DEFAULT 1,
  -- JSON array of JS Date.getDay() values, e.g. '[1,2,3,4,5]' = Mon–Fri
  days_of_week     TEXT    NOT NULL DEFAULT '[1,2,3,4,5,6,0]',
  -- Lower number = evaluated first; ties resolved by row insertion order
  priority         INTEGER NOT NULL DEFAULT 1,
  -- Max hours/day this rate covers (NULL = unlimited)
  max_hours        REAL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Insert default tariffs ────────────────────────────────────────────────────────
INSERT OR IGNORE INTO hourly_rates
  (id, title, rate, condition_text, computes_per_day, days_of_week, priority, max_hours, sort_order)
VALUES
  ('g-standard',        'G Standard',        14.25,
   'Hora ordinaria. Días laborables y sábados',
   1, '[1,2,3,4,5,6]', 1, 8,    0),

  ('g-sunday',          'G Sunday',          17.10,
   'Hora de domingo base (jornada estándar)',
   1, '[0]',            1, 8,    1),

  ('g-overtime',        'G Overtime',        21.38,
   'Horas extra ordinarias ×1.5 en días laborables',
   1, '[1,2,3,4,5,6]', 2, NULL, 2),

  ('g-sunday-overtime', 'G Sunday Overtime', 24.23,
   'Horas extra realizadas en domingo',
   1, '[0]',            2, NULL, 3),

  ('g-public-holiday',  'G Public Holiday',  28.50,
   'Festivos oficiales. Doble del G Standard del día (×2)',
   0, '[0,1,2,3,4,5,6]', 0, NULL, 4);

-- Public holidays ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public_holidays (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  date       TEXT NOT NULL,   -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert 2026 Irish public holidays ────────────────────────────────────────────
INSERT OR IGNORE INTO public_holidays (id, name, date) VALUES
  ('ph-01', 'New Year''s Day',      '2026-01-01'),
  ('ph-02', 'St Brigid''s Day',     '2026-02-02'),
  ('ph-03', 'St Patrick''s Day',    '2026-03-17'),
  ('ph-04', 'Easter Monday',        '2026-04-06'),
  ('ph-05', 'May Day',              '2026-05-04'),
  ('ph-06', 'June Bank Holiday',    '2026-06-01'),
  ('ph-07', 'August Bank Holiday',  '2026-08-03'),
  ('ph-08', 'October Bank Holiday', '2026-10-26'),
  ('ph-09', 'Christmas Day',        '2026-12-25'),
  ('ph-10', 'St Stephen''s Day',    '2026-12-26');
