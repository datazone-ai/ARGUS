import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export type UserRole = 'manager' | 'engineer'

export interface Engineer {
  id: string
  name: string
  specialisation: string
  assignedAssets: string[]
}

export const ENGINEERS: Engineer[] = [
  { id: 'eng-001', name: 'Emeka Obi',        specialisation: 'ESP / Pump Systems',       assignedAssets: ['ESP-03', 'ESP-07'] },
  { id: 'eng-002', name: 'Chidi Nwosu',      specialisation: 'Rotating Equipment',        assignedAssets: ['COMP-A', 'COMP-B'] },
  { id: 'eng-003', name: 'Amina Bello',      specialisation: 'Pipeline Integrity',        assignedAssets: ['PL-SEG1', 'FL-OML79'] },
  { id: 'eng-004', name: 'Kingsley Adeyemi', specialisation: 'Process & Separators',      assignedAssets: ['SEP-01', 'SEP-02', 'GT-A', 'PUMP-A'] },
]

export interface AuthUser {
  role: UserRole
  name: string
  engineer?: Engineer
}

interface AuthContextValue {
  user: AuthUser | null
  login: (user: AuthUser) => void
  logout: () => void
  isManager: boolean
  isEngineer: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const STORAGE_KEY = 'argus_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback((u: AuthUser) => {
    setUser(u)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isManager: user?.role === 'manager',
      isEngineer: user?.role === 'engineer',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
