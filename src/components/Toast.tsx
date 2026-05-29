/**
 * components/Toast.tsx
 * Lightweight toast notification system.
 *
 * Usage:
 *   // Wrap App in <ToastProvider>
 *   const { toast } = useToast()
 *   toast.success('Session saved')
 *   toast.error('Could not sync')
 *   toast.info('Working offline')
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error' | 'info'

interface ToastItem {
  id:       string
  message:  string
  variant:  ToastVariant
}

interface ToastAPI {
  success: (message: string) => void
  error:   (message: string) => void
  info:    (message: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI>({
  success: () => {},
  error:   () => {},
  info:    () => {},
})

// ─── Toast item component ─────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: ReactNode }> = {
  success: {
    bg:     'bg-accent/10',
    border: 'border-accent/30',
    icon:   <CheckCircle size={16} className="text-accent shrink-0" />,
  },
  error: {
    bg:     'bg-danger/10',
    border: 'border-danger/30',
    icon:   <XCircle size={16} className="text-danger shrink-0" />,
  },
  info: {
    bg:     'bg-surface-card',
    border: 'border-surface-border',
    icon:   <Info size={16} className="text-text-muted shrink-0" />,
  },
}

function ToastEl({
  item,
  onDismiss,
}: {
  item:      ToastItem
  onDismiss: (id: string) => void
}) {
  const s = VARIANT_STYLES[item.variant]

  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), 3500)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])

  return (
    <div
      className={`
        flex items-center gap-3
        ${s.bg} border ${s.border}
        rounded-card px-4 py-3 shadow-lg
        animate-slide-up
      `}
      role="alert"
    >
      {s.icon}
      <p className="flex-1 text-sm text-text-primary">{item.message}</p>
      <button
        onClick={() => onDismiss(item.id)}
        className="text-text-muted hover:text-text-secondary transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast-${++counterRef.current}`
    setToasts((prev) => [...prev.slice(-3), { id, message, variant }])
  }, [])

  const api: ToastAPI = {
    success: (m) => push(m, 'success'),
    error:   (m) => push(m, 'error'),
    info:    (m) => push(m, 'info'),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast container — sits above the bottom nav */}
      <div
        className="
          fixed bottom-20 inset-x-4 z-[999]
          flex flex-col gap-2 pointer-events-none
        "
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastEl item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastAPI {
  return useContext(ToastContext)
}
