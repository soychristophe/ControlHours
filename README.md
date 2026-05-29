# TimeIreland — Work Hours Tracker & Payroll Predictor

A **Progressive Web App** for strict work-hour tracking and Irish payroll estimation.
Built with React 18 + TypeScript + Tailwind CSS, offline-first with Cloudflare D1 sync.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| UI          | React 18 + TypeScript               |
| Styling     | Tailwind CSS v3                     |
| State       | Zustand (persisted to localStorage) |
| Build       | Vite + vite-plugin-pwa              |
| Backend DB  | Cloudflare D1 (SQLite at the edge)  |
| API         | Cloudflare Pages Functions          |
| Offline     | Service Worker (Workbox via Vite)   |

---

## Project Structure

```
timeireland/
├── functions/
│   └── api/
│       └── [[route]].ts        # Cloudflare Pages Function — REST API
├── public/                     # Static assets (icons, manifest injected by Vite)
├── src/
│   ├── components/
│   │   └── BottomNav.tsx       # 4-tab bottom navigation
│   ├── db/
│   │   └── schema.ts           # D1 schema SQL + AppDb client wrapper
│   ├── hooks/
│   │   └── useTimer.ts         # Real-time elapsed-time hook
│   ├── pages/
│   │   ├── TaskPage.tsx        # Clock in / out + live timer
│   │   ├── TimelinePage.tsx    # Session history grouped by day
│   │   ├── ReportsPage.tsx     # Pay-period summary + tax breakdown
│   │   └── SettingsPage.tsx    # Payroll settings (rate, PRSI, USC…)
│   ├── store/
│   │   └── index.ts            # Zustand store (offline-first)
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types
│   ├── utils/
│   │   └── payroll.ts          # PAYE / PRSI / USC calculation engine
│   ├── App.tsx                 # Root component + tab routing
│   ├── index.css               # Tailwind base + global styles
│   └── main.tsx                # React entry point + PWA SW registration
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml               # Cloudflare Pages + D1 config
```

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Run local dev server (no D1, offline mode only)
```bash
npm run dev
```

### 3. Set up Cloudflare D1 (for cloud sync)

```bash
# Login to Cloudflare
npx wrangler login

# Create the D1 database
npx wrangler d1 create timeireland
# Copy the database_id into wrangler.toml

# Apply the schema
npx wrangler d1 execute timeireland --file=src/db/schema.sql

# Run locally with D1 (Pages + Functions)
npx wrangler pages dev dist --d1=DB
```

### 4. Build + deploy to Cloudflare Pages
```bash
npm run build
npx wrangler pages deploy dist --project-name=timeireland
```

---

## Irish Payroll Rates (2024)

| Tax         | Rate(s)                              |
|-------------|--------------------------------------|
| PAYE        | 20% (≤ €42,000) / 40% (above)        |
| PRSI (emp.) | 4.1% (class A1, above €352/week)     |
| USC         | 0.5% / 2% / 4% / 8% (thresholds)    |
| Minimum Wage| €13.50/hr                            |

> ⚠️ Estimates only — verify with Revenue.ie or a qualified accountant.

---

## Planned Features (next iterations)

- [ ] Project tagging on sessions
- [ ] Bank holiday auto-detection (Irish calendar)
- [ ] Weekly / monthly chart (Recharts)
- [ ] CSV / PDF export
- [ ] D1 online sync with conflict resolution
- [ ] Push notifications for shift reminders
- [ ] Multiple employee profiles
