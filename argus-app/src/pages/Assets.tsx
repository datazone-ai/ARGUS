import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ChevronRight, MapPin, Wrench } from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import { useAssets } from '../context/AssetsContext'
import { useAlerts } from '../context/AlertsContext'
import type { AssetType, AssetStatus } from '../types'

const statusConfig = {
  healthy:  { label: 'Healthy',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  degraded: { label: 'Degraded', color: 'text-amber-400',   bg: 'bg-amber-500/10',   dot: 'bg-amber-400' },
  critical: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/10',     dot: 'bg-red-500' },
  offline:  { label: 'Offline',  color: 'text-slate-400',   bg: 'bg-slate-500/10',   dot: 'bg-slate-500' },
}

const typeLabel: Record<string, string> = {
  compressor: 'Compressor', pump: 'Pump', separator: 'Separator',
  pipeline: 'Pipeline', turbine: 'Turbine',
}

export default function Assets() {
  const { assets } = useAssets()
  const { getAlerts } = useAlerts()
  const allAlerts = getAlerts()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all')

  const filtered = assets.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.location.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || a.type === typeFilter
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Asset Registry" subtitle="10 monitored assets · Bonny, Brass, OML-79" />
      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as AssetType | 'all')}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Types</option>
            <option value="compressor">Compressor</option>
            <option value="pump">Pump</option>
            <option value="separator">Separator</option>
            <option value="pipeline">Pipeline</option>
            <option value="turbine">Turbine</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as AssetStatus | 'all')}
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="critical">Critical</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {(['healthy','degraded','critical','offline'] as AssetStatus[]).map(s => {
            const count = assets.filter(a => a.status === s).length
            const cfg = statusConfig[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${statusFilter === s ? cfg.bg : 'hover:bg-[var(--overlay-subtle)]'}`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={cfg.color}>{count} {cfg.label}</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Asset', 'Type', 'Location', 'Well', 'Health', 'Status', 'Open Alerts', 'Last Maintenance', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(asset => {
                const cfg = statusConfig[asset.status]
                const assetAlerts = allAlerts.filter(a => a.assetId === asset.id && a.status === 'open')
                return (
                  <tr key={asset.id} className="border-b border-[var(--border)]/50 hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium group-hover:text-blue-300 transition-colors">{asset.name}</p>
                      <p className="text-slate-600 text-xs">{asset.id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{typeLabel[asset.type]}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <MapPin size={11} className="text-slate-600" />
                        {asset.location}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{asset.associatedWell ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${asset.healthScore}%`,
                              background: asset.healthScore >= 80 ? '#10b981' : asset.healthScore >= 60 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${asset.healthScore >= 80 ? 'text-emerald-400' : asset.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                          {asset.healthScore}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {assetAlerts.length > 0 ? (
                        <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                          {assetAlerts.length}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-slate-500 text-xs">
                        <Wrench size={11} />
                        {asset.lastMaintenance}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/assets/${asset.id}`}
                        className="text-slate-500 hover:text-blue-400 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-sm">No assets match your filters.</div>
          )}
        </div>
      </div>
    </div>
  )
}
