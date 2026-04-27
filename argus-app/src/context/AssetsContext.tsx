import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Asset, SensorReading } from '../types'
import { api } from '../services/api'

interface AssetsContextValue {
  assets: Asset[]
  loading: boolean
  error: string | null
  getAssetById: (id: string) => Asset | undefined
  fetchSensorHistory: (assetId: string, sensorId: string, hours?: number) => Promise<SensorReading[]>
}

const AssetsContext = createContext<AssetsContextValue | null>(null)

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.assets.list()
      .then(data => { setAssets(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  const getAssetById = useCallback((id: string) => assets.find(a => a.id === id), [assets])

  const fetchSensorHistory = useCallback(
    (assetId: string, sensorId: string, hours = 168) =>
      api.assets.sensorHistory(assetId, sensorId, hours),
    []
  )

  return (
    <AssetsContext.Provider value={{ assets, loading, error, getAssetById, fetchSensorHistory }}>
      {children}
    </AssetsContext.Provider>
  )
}

export function useAssets() {
  const ctx = useContext(AssetsContext)
  if (!ctx) throw new Error('useAssets must be used inside AssetsProvider')
  return ctx
}
