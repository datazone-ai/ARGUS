import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Layers, Bell, Activity, Heart,
  ClipboardList, Settings, Cpu, ChevronRight, ChevronLeft, Sparkles, Droplets, LogOut
} from 'lucide-react'
import { useAlerts } from '../../context/AlertsContext'
import { useIntelligence } from '../../context/IntelligenceContext'
import { useAuth } from '../../context/AuthContext'
import { useLayout } from '../../context/LayoutContext'

const managerNav = [
  { to: '/',                icon: LayoutDashboard, label: 'Overview',          exact: true,  alertBadge: false },
  { to: '/assets',          icon: Layers,          label: 'Assets',            exact: false, alertBadge: false },
  { to: '/alerts',          icon: Bell,            label: 'Alerts',            exact: false, alertBadge: true  },
  { to: '/sensor-health',   icon: Activity,        label: 'Sensor Health',     exact: false, alertBadge: false },
  { to: '/equipment-health',icon: Heart,           label: 'Equip. Health',     exact: false, alertBadge: false },
  { to: '/predictions',     icon: Cpu,             label: 'Predictions / RUL', exact: false, alertBadge: false },
  { to: '/maintenance',     icon: ClipboardList,   label: 'Maintenance Log',   exact: false, alertBadge: false },
  { to: '/production',      icon: Droplets,        label: 'Production',        exact: false, alertBadge: false },
  { to: '/settings',        icon: Settings,        label: 'Settings',          exact: false, alertBadge: false },
]

const engineerNav = [
  { to: '/engineer',        icon: ClipboardList,   label: 'My Tasks',          exact: true,  alertBadge: false },
  { to: '/assets',          icon: Layers,          label: 'Assets',            exact: false, alertBadge: false },
  { to: '/sensor-health',   icon: Activity,        label: 'Sensor Health',     exact: false, alertBadge: false },
  { to: '/equipment-health',icon: Heart,           label: 'Equip. Health',     exact: false, alertBadge: false },
  { to: '/maintenance',     icon: ClipboardList,   label: 'Maintenance Log',   exact: false, alertBadge: false },
  { to: '/production',      icon: Droplets,        label: 'Production',        exact: false, alertBadge: false },
]

export default function Sidebar() {
  const { getOpenAlerts } = useAlerts()
  const { isOpen: aiOpen, toggle: toggleAI } = useIntelligence()
  const { user, logout, isEngineer } = useAuth()
  const { sidebarExpanded, toggleSidebar } = useLayout()
  const openAlerts = getOpenAlerts()
  const navItems = isEngineer ? engineerNav : managerNav
  const openTotal = openAlerts.length
  const hasCritical = openAlerts.some(a => a.severity === 'critical')

  const initials = user?.name
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? 'OM'

  return (
    <aside className={`fixed left-0 top-0 h-screen ${sidebarExpanded ? 'w-56' : 'w-16'} transition-all duration-200 ease-in-out bg-[var(--bg-surface)] border-r border-[var(--border)] z-40 flex flex-col overflow-hidden`}>
      {/* Logo + collapse toggle */}
      <div
        onClick={toggleSidebar}
        className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border)] min-h-[64px] cursor-pointer hover:bg-[var(--overlay-subtle)] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">AR</span>
        </div>
        <span className={`text-white font-bold text-sm whitespace-nowrap transition-opacity duration-150 flex-1 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
          ARGUS
        </span>
        {sidebarExpanded && <ChevronLeft size={14} className="text-slate-400 flex-shrink-0" />}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, alertBadge, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `relative flex items-center gap-3 mx-2 px-2 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-[var(--overlay-subtle)] hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  <Icon size={18} />
                  {alertBadge && openTotal > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${hasCritical ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
                      {openTotal}
                    </span>
                  )}
                </div>
                <span className={`whitespace-nowrap text-sm font-medium transition-opacity duration-150 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  {label}
                </span>
                {isActive && sidebarExpanded && (
                  <ChevronRight size={12} className="ml-auto" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-4 border-t border-[var(--border)] space-y-2">
        {/* AI Toggle */}
        <button
          onClick={toggleAI}
          title="Assets Intelligence"
          className={`relative flex items-center gap-3 w-full px-2 py-2.5 rounded-lg transition-colors duration-150 ${
            aiOpen
              ? 'bg-violet-600/20 text-violet-400'
              : 'text-slate-400 hover:bg-[var(--overlay-subtle)] hover:text-slate-200'
          }`}
        >
          <div className="relative flex-shrink-0 w-8 h-8 flex items-center justify-center">
            <Sparkles size={18} />
            {aiOpen && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-400" />}
          </div>
          <span className={`whitespace-nowrap text-sm font-medium transition-opacity duration-150 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
            AI Assistant
          </span>
        </button>

        {/* User + logout */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className={`transition-opacity duration-150 min-w-0 flex-1 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-xs font-medium text-slate-200 truncate">{user?.name ?? 'Ops Manager'}</p>
            <p className="text-[10px] text-slate-500 truncate">Bonny Terminal</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className={`transition-opacity text-slate-600 hover:text-slate-300 flex-shrink-0 ${sidebarExpanded ? 'opacity-100' : 'opacity-0'}`}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
