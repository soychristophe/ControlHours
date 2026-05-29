# TimeIreland — Work Hours Tracker & Payroll Predictor

A **Progressive Web App** for strict work-hour tracking and Irish payroll estimation.
Built with React 18 + TypeScript + Tailwind CSS, offline-first (IndexedDB) with Cloudflare D1 sync.

---

## Tech Stack

| Layer         | Technology                                  |
|---------------|---------------------------------------------|
| UI            | React 18 + TypeScript                       |
| Styling       | Tailwind CSS v3 (DM Sans + JetBrains Mono)  |
| State         | Zustand (persisted to localStorage)         |
| Offline DB    | IndexedDB (custom shim in `src/db/offline`) |
| Cloud DB      | Cloudflare D1 (SQLite at the edge)          |
| API           | Cloudflare Pages Functions (`functions/`)   |
| Build         | Vite + vite-plugin-pwa (Workbox)            |
| Sync          | `useSync` hook — queues → flushes on online |

---

## Project Structure

```
timeireland/
├── functions/
│   └── api/[[route]].ts          # REST API (Cloudflare Pages Function)
├── src/
│   ├── components/
│   │   ├── BottomNav.tsx          # 4-tab bottom navigation
│   │   ├── SessionCard.tsx        # Reusable session card
│   │   ├── SyncBadge.tsx          # Online/offline/syncing indicator
│   │   └── Toast.tsx              # Toast notification system
│   ├── db/
│   │   ├── offline.ts             # IndexedDB shim (mirrors D1 schema)
│   │   ├── schema.sql             # SQL for `wrangler d1 execute`
│   │   └── schema.ts              # D1 TypeScript types + AppDb wrapper
│   ├── hooks/
│   │   ├── useSync.ts             # Sync queue → D1 flush hook
│   │   └── useTimer.ts            # Real-time elapsed-time hook
│   ├── pages/
│   │   ├── TaskPage.tsx           # Clock in/out + live timer + note
│   │   ├── TimelinePage.tsx       # Calendar • week strip • timeline blocks
│   │   ├── ReportsPage.tsx        # PAYE / PRSI / USC pay-period summary
│   │   └── SettingsPage.tsx       # Payroll config + sync status
│   ├── store/
│   │   └── index.ts               # Zustand store (offline-first)
│   ├── types/
│   │   └── index.ts               # Shared TypeScript types
│   ├── utils/
│   │   ├── irishCalendar.ts       # Bank holiday detection + suggestShiftType
│   │   └── payroll.ts             # PAYE + PRSI + USC calculation engine
│   ├── App.tsx                    # Root component (ToastProvider + pages)
│   ├── index.css                  # Tailwind base + global styles
│   ├── main.tsx                   # React entry + PWA SW registration
│   └── vite-env.d.ts              # Env var + PWA virtual module types
├── index.html
├── package.json
├── tailwind.config.js             # Includes slide-up animation
├── tsconfig.json
├── vite.config.ts                 # PWA plugin config (Workbox)
└── wrangler.toml                  # Cloudflare Pages + D1 binding
```

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Set VITE_API_BASE=https://your-pages-domain.pages.dev
```

### 3. Run local dev (offline mode — no D1 needed)
```bash
npm run dev
```

### 4. Set up Cloudflare D1
```bash
npx wrangler login
npx wrangler d1 create timeireland
# Paste the database_id into wrangler.toml

npx wrangler d1 execute timeireland --file=src/db/schema.sql
```

### 5. Run locally with D1
```bash
npm run build
npx wrangler pages dev dist --d1=DB
```

### 6. Deploy
```bash
npm run build
npx wrangler pages deploy dist --project-name=timeireland
```

---

## Irish Payroll Rates (2024)

| Tax              | Rate(s)                                        |
|------------------|------------------------------------------------|
| PAYE             | 20% (≤ €42,000 single) / 40% (above)           |
| PRSI (employee)  | 4.1% (class A1, if weekly gross > €352)        |
| USC              | 0.5% / 2% / 4% / 8% (stepped thresholds)      |
| Minimum Wage     | €13.50/hr (Jan 2024)                           |
| Overtime         | ×1.5 (statutory minimum)                       |
| Sunday premium   | ×1.5 (common practice)                        |
| Bank Holiday     | ×2.0 or paid day off (OWT Act 1997)            |

> ⚠️ Estimates only — verify with Revenue.ie or a qualified accountant.

---

## Offline & Sync Architecture

```
User action
    │
    ▼
Zustand store (in-memory, fast)
    │
    ├── localStorage (persisted state)
    │
    └── IndexedDB (offline.ts)
           • Mirrors every mutation
           • Queues items in sync_queue store
           │
           └── useSync hook
                  • Watches navigator.onLine
                  • On reconnect → flushes queue → Cloudflare D1 via API
```

---

## Bank Holidays auto-detected (2024–2026)

`utils/irishCalendar.ts` provides:
- `irishBankHolidays(year)` — full list for any year
- `getBankHoliday(date)` — lookup for a specific date
- `suggestShiftType(date)` — returns `'bank_holiday' | 'sunday' | 'regular'`

Used by `TimelinePage` to auto-tag new manual sessions.

---

## Planned Features

- [ ] Auto-tag bank holidays when clocking in
- [ ] Weekly / monthly earnings chart (Recharts)
- [ ] CSV / PDF payslip export
- [ ] Multiple employee profiles
- [ ] Push notifications for shift reminders
- [ ] Edit existing sessions inline
- [ ] Project tagging with per-project hourly rate
