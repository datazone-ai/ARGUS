import { createContext, useContext, useCallback, useReducer } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning'
}

type Action =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string }

function reducer(state: Toast[], action: Action): Toast[] {
  if (action.type === 'ADD') return [...state, action.toast]
  return state.filter(t => t.id !== action.id)
}

interface ToastContextValue {
  success: (msg: string) => void
  error: (msg: string) => void
  warning: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let idCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, [])

  const push = useCallback((message: string, type: Toast['type']) => {
    const id = String(++idCounter)
    dispatch({ type: 'ADD', toast: { id, message, type } })
    setTimeout(() => dispatch({ type: 'REMOVE', id }), 3500)
  }, [])

  const success = useCallback((msg: string) => push(msg, 'success'), [push])
  const error   = useCallback((msg: string) => push(msg, 'error'), [push])
  const warning = useCallback((msg: string) => push(msg, 'warning'), [push])

  const iconMap = { success: CheckCircle2, error: XCircle, warning: AlertTriangle }
  const colorMap = {
    success: 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300',
    error:   'border-red-500/40 bg-red-950/60 text-red-300',
    warning: 'border-amber-500/40 bg-amber-950/60 text-amber-300',
  }

  return (
    <ToastContext.Provider value={{ success, error, warning }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = iconMap[t.type]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium pointer-events-auto backdrop-blur-sm ${colorMap[t.type]}`}
              style={{ animation: 'slideIn 0.2s ease-out' }}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span>{t.message}</span>
              <button
                onClick={() => dispatch({ type: 'REMOVE', id: t.id })}
                className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
