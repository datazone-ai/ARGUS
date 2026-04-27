import { Bell, Sun, Moon } from 'lucide-react'
import { useAlerts } from '../../context/AlertsContext'
import { useTheme } from '../../context/ThemeContext'
import { useState, useEffect } from 'react'

interface TopBarProps {
  title: string
  subtitle?: string
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { getOpenAlerts } = useAlerts()
  const { theme, toggleTheme } = useTheme()
  const openCritical = getOpenAlerts().filter(a => a.severity === 'critical').length

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg-base)]/80 backdrop-blur-sm sticky top-0 z-30">
      <div>
        <h1 className="text-white font-semibold text-base leading-tight">{title}</h1>
        {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-slate-300 text-xs font-medium">{dateStr} · {timeStr} WAT</p>
          </div>
          <p className="text-slate-600 text-[10px]">Live · Bonny Terminal</p>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg hover:bg-[var(--overlay-subtle)] text-slate-400 hover:text-slate-200 transition-colors"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Alerts bell */}
        <button className="relative p-2 rounded-lg hover:bg-[var(--overlay-subtle)] text-slate-400 hover:text-slate-200 transition-colors">
          <Bell size={15} />
          {openCritical > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </div>
    </header>
  )
}
