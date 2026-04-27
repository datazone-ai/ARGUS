import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface IntelligenceContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null)

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open   = useCallback(() => setIsOpen(true), [])
  const close  = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])

  return (
    <IntelligenceContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </IntelligenceContext.Provider>
  )
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext)
  if (!ctx) throw new Error('useIntelligence must be used inside IntelligenceProvider')
  return ctx
}
