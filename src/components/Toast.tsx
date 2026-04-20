'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Polite region for success/info toasts */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-full max-w-sm"
      >
        {toasts.filter(t => t.type !== 'error').map((t) => (
          <div
            key={t.id}
            className={`animate-fade-in flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white ${
              t.type === 'success' ? 'bg-green-600' : 'bg-gray-800'
            }`}
          >
            <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
              {t.type === 'success' ? '✓' : 'ℹ'}
            </span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
      {/* Assertive region for error toasts — announced immediately */}
      <div
        aria-live="assertive"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      >
        {toasts.filter(t => t.type === 'error').map((t) => (
          <div
            key={t.id}
            className="animate-fade-in flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white bg-red-600 pointer-events-auto"
          >
            <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">✕</span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
