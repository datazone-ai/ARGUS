import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('argus-theme') as Theme) ?? 'dark'
  )

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    localStorage.setItem('argus-theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
