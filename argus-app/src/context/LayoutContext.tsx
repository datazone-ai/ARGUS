import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface LayoutContextValue {
  sidebarExpanded: boolean
  toggleSidebar: () => void
}

const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const toggleSidebar = useCallback(() => setSidebarExpanded(v => !v), [])

  return (
    <LayoutContext.Provider value={{ sidebarExpanded, toggleSidebar }}>
      {children}
    </LayoutContext.Provider>
  )
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used inside LayoutProvider')
  return ctx
}
