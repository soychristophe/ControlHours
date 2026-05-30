/**
 * App.tsx
 * Root component — wraps everything in providers and renders the active page.
 *
 * Auth flow (local profiles, no server):
 *  1. On mount, check localStorage for an active profile ID.
 *  2. If found  → auto-login, go straight to the app.
 *  3. If absent → show ProfileSelectPage.
 *  4. SettingsPage can trigger onSwitchProfile → clear active ID → show ProfileSelectPage again.
 */

import { useState, useEffect }  from 'react'
import { useAppStore }           from '@/store'
import { BottomNav }             from '@/components/BottomNav'
import { ToastProvider }         from '@/components/Toast'
import { TaskPage }              from '@/pages/TaskPage'
import { TimelinePage }          from '@/pages/TimelinePage'
import { ReportsPage }           from '@/pages/ReportsPage'
import { SettingsPage }          from '@/pages/SettingsPage'
import { ProfileSelectPage }     from '@/pages/ProfileSelectPage'
import {
  getActiveProfileId,
  setActiveProfileId,
  snapshotProfile,
} from '@/utils/backup'

// ─── Page map ─────────────────────────────────────────────────────────────────

const PAGE_MAP = {
  task:     <TaskPage />,
  timeline: <TimelinePage />,
  reports:  <ReportsPage />,
  settings: null,   // rendered separately so it can receive onSwitchProfile
} as const

// ─── Inner app (shown after login) ────────────────────────────────────────────

function AppShell({ onSwitchProfile }: { onSwitchProfile: () => void }) {
  const activeTab = useAppStore((s) => s.activeTab)
  const isTimeline = activeTab === 'timeline'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: isTimeline ? 'hidden' : 'auto',
          paddingBottom: isTimeline
            ? undefined
            : 'calc(4rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {activeTab === 'settings'
          ? <SettingsPage onSwitchProfile={onSwitchProfile} />
          : PAGE_MAP[activeTab]
        }
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  // null  = not yet determined (avoids flash)
  // false = no active profile → show ProfileSelectPage
  // id    = logged-in profile
  const [profileId, setProfileId] = useState<string | null | false>(null)

  // On mount: check for existing active profile
  useEffect(() => {
    const id = getActiveProfileId()
    if (id) {
      snapshotProfile(id)      // refresh last-seen timestamp
      setProfileId(id)
    } else {
      setProfileId(false)
    }
  }, [])

  function handleLogin(id: string) {
    setProfileId(id)
  }

  function handleSwitchProfile() {
    setActiveProfileId(null)
    setProfileId(false)
  }

  // Still determining → blank screen (prevents profile flash)
  if (profileId === null) return null

  // Not logged in → profile picker
  if (profileId === false) {
    return (
      <ToastProvider>
        <ProfileSelectPage onLogin={handleLogin} />
      </ToastProvider>
    )
  }

  // Logged in → main app
  return (
    <ToastProvider>
      <AppShell onSwitchProfile={handleSwitchProfile} />
    </ToastProvider>
  )
}
