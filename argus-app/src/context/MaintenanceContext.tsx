import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { MaintenanceRecord } from '../types'
import { api } from '../services/api'

interface MaintenanceContextValue {
  records: MaintenanceRecord[]
  loading: boolean
  getByAsset: (assetId: string) => MaintenanceRecord[]
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null)

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.maintenance.list()
      .then(data => { setRecords(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const getByAsset = useCallback(
    (assetId: string) =>
      records
        .filter(r => r.assetId === assetId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [records]
  )

  return (
    <MaintenanceContext.Provider value={{ records, loading, getByAsset }}>
      {children}
    </MaintenanceContext.Provider>
  )
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext)
  if (!ctx) throw new Error('useMaintenance must be used inside MaintenanceProvider')
  return ctx
}
