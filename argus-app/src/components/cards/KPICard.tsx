import type { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  sub?: string
  icon: LucideIcon
  iconColor?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  alert?: boolean
}

export default function KPICard({
  title, value, sub, icon: Icon, iconColor = 'text-blue-400',
  trend, trendLabel, alert
}: KPICardProps) {
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-emerald-400' : 'text-slate-400'

  return (
    <div className={`bg-[var(--bg-surface)] border rounded-xl p-4 flex flex-col gap-3 ${alert ? 'border-red-500/40' : 'border-[var(--border)]'}`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">{title}</span>
        <div className={`p-1.5 rounded-lg bg-[var(--overlay-subtle)] ${iconColor}`}>
          <Icon size={14} />
        </div>
      </div>
      <div>
        <div className="text-white text-2xl font-bold">{value}</div>
        {sub && <div className="text-slate-500 text-xs mt-0.5">{sub}</div>}
      </div>
      {trendLabel && (
        <div className={`text-xs ${trendColor}`}>{trendLabel}</div>
      )}
    </div>
  )
}
