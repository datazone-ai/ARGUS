import { useState } from 'react'
import TopBar from '../components/layout/TopBar'
import AlertCard from '../components/cards/AlertCard'
import { useAlerts } from '../context/AlertsContext'
import type { AlertSeverity } from '../types'
import { CheckCircle2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const severityOrder: AlertSeverity[] = ['critical', 'high', 'medium', 'low']

const trendData = Array.from({ length: 30 }, (_, i) => ({
  day: `Dec ${i + 2}`,
  critical: Math.floor(Math.random() * 3),
  high: Math.floor(Math.random() * 4),
  medium: Math.floor(Math.random() * 3),
  low: Math.floor(Math.random() * 2),
}))

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all')
  const [view, setView] = useState<'open' | 'all'>('open')
  const { getOpenAlerts, getAlerts } = useAlerts()

  const open = getOpenAlerts()
  const all = getAlerts()
  const base = view === 'open' ? open : all
  const totalExposure = open.reduce((s, a) => s + a.financialImpactUsd, 0)

  const filtered = base
    .filter(a => severityFilter === 'all' || a.severity === severityFilter)
    .sort((a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity))

  const counts = {
    critical: open.filter(a => a.severity === 'critical').length,
    high: open.filter(a => a.severity === 'high').length,
    medium: open.filter(a => a.severity === 'medium').length,
    low: open.filter(a => a.severity === 'low').length,
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Alerts & Recommendations" subtitle={`${open.length} open alerts · $${(totalExposure / 1_000_000).toFixed(1)}M total exposure`} />
      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Critical', count: counts.critical, color: 'text-red-400', bg: 'border-red-500/30 bg-red-500/5', sev: 'critical' as AlertSeverity },
            { label: 'High', count: counts.high, color: 'text-orange-400', bg: 'border-orange-500/30 bg-orange-500/5', sev: 'high' as AlertSeverity },
            { label: 'Medium', count: counts.medium, color: 'text-amber-400', bg: 'border-amber-500/30 bg-amber-500/5', sev: 'medium' as AlertSeverity },
            { label: 'Low', count: counts.low, color: 'text-blue-400', bg: 'border-blue-500/30 bg-blue-500/5', sev: 'low' as AlertSeverity },
          ].map(({ label, count, color, bg, sev }) => (
            <button
              key={label}
              onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
              className={`rounded-xl border p-4 text-left transition-all ${bg} ${severityFilter === sev ? 'ring-1 ring-blue-500/50' : ''}`}
            >
              <p className="text-slate-500 text-[10px] uppercase tracking-wide">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* Alerts list */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-1">
                <button
                  onClick={() => setView('open')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'open' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Open ({open.length})
                </button>
                <button
                  onClick={() => setView('all')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${view === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  All ({all.length})
                </button>
              </div>
              {severityFilter !== 'all' && (
                <button onClick={() => setSeverityFilter('all')} className="text-blue-400 text-xs hover:text-blue-300">Clear filter</button>
              )}
            </div>
            {filtered.map(alert => <AlertCard key={alert.id} alert={alert} />)}
            {filtered.length === 0 && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-10 text-center">
                <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No {severityFilter} alerts open.</p>
              </div>
            )}
          </div>

          {/* Alert trend */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-4">Alert Trend — 30 days</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }} />
                  <Bar dataKey="critical" stackId="a" fill="#ef4444" />
                  <Bar dataKey="high" stackId="a" fill="#f97316" />
                  <Bar dataKey="medium" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="low" stackId="a" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-3">
                {[['Critical','#ef4444'],['High','#f97316'],['Medium','#f59e0b'],['Low','#3b82f6']].map(([label, color]) => (
                  <div key={label} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Financial summary */}
              <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2">
                <p className="text-slate-500 text-[10px] uppercase tracking-wide">Financial Exposure</p>
                {getAlerts().filter(a => a.status === 'open').map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 truncate flex-1 mr-2">{a.assetName}</span>
                    <span className="text-red-400 font-medium">
                      ${(a.financialImpactUsd / 1_000_000).toFixed(1)}M
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border)]">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-red-400 font-bold">${(totalExposure / 1_000_000).toFixed(1)}M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
