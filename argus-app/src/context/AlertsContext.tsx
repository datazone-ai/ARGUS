import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Alert } from '../types'
import { api } from '../services/api'

type AlertStatus = 'open' | 'snoozed' | 'dismissed' | 'resolved' | 'acknowledged'

interface AlertState {
  alerts: Alert[]
  statuses: Record<string, AlertStatus>
}

type Action =
  | { type: 'SET_ALERTS'; alerts: Alert[] }
  | { type: 'DISMISS'; id: string }
  | { type: 'SNOOZE'; id: string }
  | { type: 'RESOLVE'; id: string }
  | { type: 'REOPEN'; id: string }
  | { type: 'ACKNOWLEDGE'; id: string }

function reducer(state: AlertState, action: Action): AlertState {
  if (action.type === 'SET_ALERTS') {
    return { ...state, alerts: action.alerts }
  }
  const nextStatus: AlertStatus =
    action.type === 'DISMISS'     ? 'dismissed'    :
    action.type === 'SNOOZE'      ? 'snoozed'      :
    action.type === 'RESOLVE'     ? 'resolved'     :
    action.type === 'ACKNOWLEDGE' ? 'acknowledged' : 'open'
  return {
    ...state,
    statuses: { ...state.statuses, [action.id]: nextStatus },
  }
}

interface AlertsContextValue {
  loading: boolean
  getStatus: (id: string) => AlertStatus
  getAlerts: () => Alert[]
  getOpenAlerts: () => Alert[]
  dismiss: (id: string) => void
  snooze: (id: string) => void
  resolve: (id: string) => void
  reopen: (id: string) => void
  acknowledge: (id: string) => void
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { alerts: [], statuses: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.alerts.list()
      .then(alerts => {
        dispatch({ type: 'SET_ALERTS', alerts })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const getStatus = useCallback(
    (id: string): AlertStatus => state.statuses[id] ?? state.alerts.find(a => a.id === id)?.status ?? 'open',
    [state]
  )

  const getAlerts = useCallback(
    () => state.alerts.map(a => ({ ...a, status: state.statuses[a.id] ?? a.status })),
    [state]
  )

  const getOpenAlerts = useCallback(
    () => getAlerts().filter(a => a.status === 'open'),
    [getAlerts]
  )

  const syncStatus = (id: string, status: AlertStatus) => {
    api.alerts.updateStatus(id, status).catch(() => {})
  }

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id })
    syncStatus(id, 'dismissed')
  }, [])

  const snooze = useCallback((id: string) => {
    dispatch({ type: 'SNOOZE', id })
    syncStatus(id, 'snoozed')
  }, [])

  const resolve = useCallback((id: string) => {
    dispatch({ type: 'RESOLVE', id })
    syncStatus(id, 'resolved')
  }, [])

  const reopen = useCallback((id: string) => {
    dispatch({ type: 'REOPEN', id })
    syncStatus(id, 'open')
  }, [])

  const acknowledge = useCallback((id: string) => {
    dispatch({ type: 'ACKNOWLEDGE', id })
    syncStatus(id, 'acknowledged')
  }, [])

  return (
    <AlertsContext.Provider value={{ loading, getStatus, getAlerts, getOpenAlerts, dismiss, snooze, resolve, reopen, acknowledge }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertsContext)
  if (!ctx) throw new Error('useAlerts must be used inside AlertsProvider')
  return ctx
}
