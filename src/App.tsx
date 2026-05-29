/**
 * App.tsx
 * Root component — wraps everything in providers and renders the active page.
 */

import { useAppStore }   from '@/store'
import { BottomNav }     from '@/components/BottomNav'
import { ToastProvider } from '@/components/Toast'
import { TaskPage }      from '@/pages/TaskPage'
import { TimelinePage }  from '@/pages/TimelinePage'
import { ReportsPage }   from '@/pages/ReportsPage'
import { SettingsPage }  from '@/pages/SettingsPage'

const PAGE_MAP = {
  task:     <TaskPage />,
  timeline: <TimelinePage />,
  reports:  <ReportsPage />,
  settings: <SettingsPage />,
} as const

// Pages that manage their own internal scroll (fixed header + scrollable body)
const SELF_SCROLL_TABS = new Set(['timeline', 'reports'])

function Pages() {
  const activeTab = useAppStore((s) => s.activeTab)
  const selfScroll = SELF_SCROLL_TABS.has(activeTab)
  return (
    <main
      style={{
        flex: 1,
        minHeight: 0,          // critical: lets flex child shrink in a fixed-height flex column
        display: 'flex',
        flexDirection: 'column',
        overflow: selfScroll ? 'hidden' : 'auto',
        paddingBottom: selfScroll ? undefined : 'calc(4rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {PAGE_MAP[activeTab]}
    </main>
  )
}

export default function App() {
  return (
    <ToastProvider>
      {/* height: 100% propagates the fixed height from #root down the tree */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Pages />
        <BottomNav />
      </div>
    </ToastProvider>
  )
}
