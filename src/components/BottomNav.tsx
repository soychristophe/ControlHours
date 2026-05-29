/**
 * components/BottomNav.tsx
 * Fixed bottom navigation bar — 4 tabs.
 */

import { CheckSquare, Clock, BarChart3, Settings } from 'lucide-react'
import { useAppStore } from '@/store'
import type { TabId } from '@/types'

interface NavItem {
  id: TabId
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'task',
    label: 'TASK',
    icon: <CheckSquare size={22} strokeWidth={1.5} />,
  },
  {
    id: 'timeline',
    label: 'TIMELINE',
    icon: <Clock size={22} strokeWidth={1.5} />,
  },
  {
    id: 'reports',
    label: 'REPORTS',
    icon: <BarChart3 size={22} strokeWidth={1.5} />,
  },
  {
    id: 'settings',
    label: 'SETTINGS',
    icon: <Settings size={22} strokeWidth={1.5} />,
  },
]

export function BottomNav() {
  const activeTab    = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <nav
      className="
        fixed bottom-0 inset-x-0 z-50
        bg-surface-raised border-t border-surface-border
        flex items-stretch
        pb-safe           /* respects iOS home indicator */
      "
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1 py-3
              transition-colors duration-150 select-none
              ${isActive
                ? 'text-accent'
                : 'text-text-muted hover:text-text-secondary active:text-text-secondary'
              }
            `}
          >
            <span
              className={`
                transition-transform duration-150
                ${isActive ? 'scale-110' : 'scale-100'}
              `}
            >
              {item.icon}
            </span>
            <span
              className={`
                font-mono text-[9px] tracking-widest font-medium
                ${isActive ? 'text-accent' : 'text-text-muted'}
              `}
            >
              {item.label}
            </span>

            {/* Active indicator dot */}
            {isActive && (
              <span className="absolute bottom-[env(safe-area-inset-bottom,0px)] mb-1 w-1 h-1 rounded-full bg-accent" />
            )}
          </button>
        )
      })}
    </nav>
  )
}
