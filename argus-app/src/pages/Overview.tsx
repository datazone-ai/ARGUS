import { Layers, AlertTriangle, DollarSign, Activity, ClipboardList, CheckCircle2, Clock, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import TopBar from '../components/layout/TopBar'
import KPICard from '../components/cards/KPICard'
import AlertCard from '../components/cards/AlertCard'
import { useAssets } from '../context/AssetsContext'
import { useAlerts } from '../context/AlertsContext'
import { useWorkOrders } from '../context/WorkOrderContext'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'

const statusColor: Record<string, string> = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  critical: '#ef4444',
  offline: '#6b7280',
}

const riskTrend = Array.from({ length: 30 }, (_, i) => ({
  day: `Dec ${i + 2}`,
  bopd: Math.round(1800 + Math.sin(i * 0.4) * 600 + i * 120 + (i * 17 % 200)),
}))

const typeLabel: Record<string, string> = {
  compressor: 'Compressor', pump: 'Pump', separator: 'Separator',
  pipeline: 'Pipeline', turbine: 'Turbine',
}

export default function Overview() {
  const { assets } = useAssets()
  const { getOpenAlerts, getAlerts } = useAlerts()
  const { records: workOrders } = useWorkOrders()
  const openAlerts = getOpenAlerts()
  const allAlerts = getAlerts()
  const criticalAlerts = openAlerts.filter(a => a.severity === 'critical')
  const totalExposure = openAlerts.reduce((s, a) => s + a.financialImpactUsd, 0)
  const totalBopd = openAlerts.reduce((s, a) => s + a.predictedImpactBopd, 0)

  const healthGroups = [
    { name: 'Healthy',  value: assets.filter(a => a.status === 'healthy').length,  color: '#10b981' },
    { name: 'Degraded', value: assets.filter(a => a.status === 'degraded').length, color: '#f59e0b' },
    { name: 'Critical', value: assets.filter(a => a.status === 'critical').length, color: '#ef4444' },
    { name: 'Offline',  value: assets.filter(a => a.status === 'offline').length,  color: '#6b7280' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Operations Overview" subtitle="Wragby Predictive Maintenance — Nigerian Upstream O&G" />

      <div className="flex-1 p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="Total Assets" value={assets.length} sub="10 monitored" icon={Layers} iconColor="text-blue-400" />
          <KPICard title="Critical" value={criticalAlerts.length} sub="open alerts" icon={AlertTriangle} iconColor="text-red-400" alert={criticalAlerts.length > 0} trendLabel="Requires immediate action" trend="up" />
          <KPICard title="Degraded" value={assets.filter(a => a.status === 'degraded').length} sub="assets" icon={Activity} iconColor="text-amber-400" trendLabel="Monitor closely" />
          <KPICard title="Open Alerts" value={openAlerts.length} sub={`${criticalAlerts.length} critical`} icon={AlertTriangle} iconColor="text-orange-400" />
          <KPICard title="BOPD at Risk" value={totalBopd.toLocaleString()} sub="from open alerts" icon={Activity} iconColor="text-amber-400" trendLabel="If no action taken" trend="up" />
          <KPICard title="Financial Exposure" value={`$${(totalExposure / 1_000_000).toFixed(1)}M`} sub="deferred production risk" icon={DollarSign} iconColor="text-emerald-400" alert trendLabel="All open alerts combined" />
        </div>

        {/* Main content */}
        <div className="grid grid-cols-12 gap-6">
          {/* Priority Alerts */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Priority Alerts</h2>
              <Link to="/alerts" className="text-blue-400 text-xs hover:text-blue-300">View all →</Link>
            </div>
            {openAlerts.length === 0 && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 text-center text-slate-500 text-sm">
                All alerts resolved or dismissed.
              </div>
            )}
            {openAlerts
              .sort((a, b) => b.financialImpactUsd - a.financialImpactUsd)
              .slice(0, 3)
              .map(alert => (
                <AlertCard key={alert.id} alert={alert} compact />
              ))}
          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h2 className="text-white font-semibold text-sm mb-4">Fleet Health Distribution</h2>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={healthGroups} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                      {healthGroups.map(g => <Cell key={g.name} fill={g.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {healthGroups.map(g => (
                    <div key={g.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                      <span className="text-slate-400 text-xs">{g.name}</span>
                      <span className="text-white text-xs font-bold ml-auto">{g.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h2 className="text-white font-semibold text-sm mb-4">BOPD at Risk — 30 Day Trend</h2>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={riskTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }} />
                  <Area type="monotone" dataKey="bopd" stroke="#ef4444" fill="url(#riskGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Work Order Status Board */}
        {workOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <ClipboardList size={14} className="text-orange-400" />
                Work Order & Case Status
              </h2>
              <Link to="/maintenance" className="text-blue-400 text-xs hover:text-blue-300">View all →</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Open',        status: 'confirmed',   icon: ClipboardList,  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'In Progress', status: 'in_progress', icon: Clock,          color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Completed',   status: 'completed',   icon: CheckCircle2,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Assigned',    status: null,          icon: Users,          color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
              ].map(({ label, status, icon: Icon, color, bg }) => {
                const count = status
                  ? workOrders.filter(w => w.status === status).length
                  : workOrders.filter(w => w.assignedTo).length
                return (
                  <div key={label} className={`rounded-xl border ${bg} px-4 py-3 flex items-center gap-3`}>
                    <Icon size={18} className={color} />
                    <div>
                      <p className={`text-xl font-bold ${color}`}>{count}</p>
                      <p className="text-slate-500 text-xs">{label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Asset Fleet */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">Asset Fleet</h2>
            <Link to="/assets" className="text-blue-400 text-xs hover:text-blue-300">View registry →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {assets.map(asset => {
              const assetAlerts = allAlerts.filter(a => a.assetId === asset.id && a.status === 'open')
              return (
                <Link
                  key={asset.id}
                  to={`/assets/${asset.id}`}
                  className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3 hover:border-blue-500/40 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor[asset.status] }} />
                    {assetAlerts.length > 0 && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                        {assetAlerts.length}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-xs font-semibold leading-tight group-hover:text-blue-300 transition-colors">
                    {asset.name}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">{typeLabel[asset.type]}</p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 text-[10px]">Health</span>
                      <span className={`text-xs font-bold ${asset.healthScore >= 80 ? 'text-emerald-400' : asset.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                        {asset.healthScore}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-[var(--border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${asset.healthScore}%`,
                          background: asset.healthScore >= 80 ? '#10b981' : asset.healthScore >= 60 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
