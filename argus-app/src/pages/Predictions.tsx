import TopBar from '../components/layout/TopBar'
import { useAssets } from '../context/AssetsContext'
import { useAlerts } from '../context/AlertsContext'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine
} from 'recharts'
import { useState } from 'react'
import { Clock, TrendingDown, AlertTriangle } from 'lucide-react'
import type { Asset } from '../types'

export default function Predictions() {
  const { assets: ASSETS } = useAssets()
  const { getOpenAlerts } = useAlerts()
  const openAlerts = getOpenAlerts()

  const getRUL = (asset: Asset): number => {
    const alert = openAlerts.find(a => a.assetId === asset.id)
    if (alert) return Math.round((alert.timeToFailureMin + alert.timeToFailureMax) / 2)
    if (asset.status === 'healthy') return 120
    return 45
  }

  const getImpact = (assetId: string): number => {
    const alert = openAlerts.find(a => a.assetId === assetId)
    return alert?.predictedImpactBopd ?? 0
  }

  const [selectedId, setSelectedId] = useState('')
  const effectiveId = selectedId || ASSETS.find(a => a.status === 'critical')?.id || ASSETS[0]?.id || ''
  const selected = ASSETS.find(a => a.id === effectiveId)

  if (!selected) return null

  const scatterData = ASSETS.map(a => ({
    id: a.id,
    name: a.name,
    x: getRUL(a),
    y: getImpact(a.id),
    healthScore: a.healthScore,
    status: a.status,
  }))

  const rulDays = getRUL(selected)
  const degradeRate = selected.status === 'critical' ? 1.8 : selected.status === 'degraded' ? 0.6 : 0.2

  const projectionData = Array.from({ length: 91 }, (_, i) => {
    const projected = Math.max(0, selected.healthScore - degradeRate * i)
    const withMaint = i > 30 ? Math.min(95, projected + 28) : projected
    return { day: i, projected: +projected.toFixed(1), withMaintenance: +withMaint.toFixed(1) }
  })

  const sortedByRisk = [...ASSETS]
    .map(a => ({ ...a, rul: getRUL(a), impact: getImpact(a.id) }))
    .sort((a, b) => a.rul - b.rul)

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    const color = payload.healthScore >= 80 ? '#10b981' : payload.healthScore >= 60 ? '#f59e0b' : '#ef4444'
    return (
      <g>
        <circle cx={cx} cy={cy} r={payload.id === selectedId ? 10 : 7} fill={color} fillOpacity={0.8} stroke={payload.id === selectedId ? '#fff' : 'none'} strokeWidth={2} />
      </g>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Predictions & RUL" subtitle="Failure risk matrix, remaining useful life estimates, decline projections" />
      <div className="p-6 space-y-5">
        {/* Risk Matrix */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-white font-semibold text-sm mb-1">Failure Risk Matrix</h3>
          <p className="text-slate-500 text-xs mb-4">X: Days to predicted failure · Y: Production impact (BOPD) · Click an asset to drill in</p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
              <XAxis
                type="number" dataKey="x" name="Days to Failure"
                label={{ value: 'Days to Predicted Failure', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 11 }}
                tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}
                domain={[0, 130]}
              />
              <YAxis
                type="number" dataKey="y" name="BOPD at Risk"
                label={{ value: 'BOPD at Risk', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
                tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#2d3748' }}
                contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }}
                formatter={(v: any) => [v, '']}
                labelFormatter={() => ''}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-[#1a2035] border border-[#2d3748] rounded-lg p-2 text-xs">
                      <p className="text-white font-semibold">{d.name}</p>
                      <p className="text-slate-400">RUL: ~{d.x} days</p>
                      <p className="text-slate-400">Impact: {d.y.toLocaleString()} BOPD</p>
                      <p className="text-slate-400">Health: {d.healthScore}</p>
                    </div>
                  )
                }}
              />
              <Scatter
                data={scatterData}
                shape={<CustomDot />}
                onClick={(d: any) => setSelectedId(d.id || '')}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 justify-end text-[10px] text-slate-500 mt-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Degraded</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Critical</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* RUL Table */}
          <div className="col-span-12 md:col-span-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <h3 className="text-white font-semibold text-sm">RUL Estimates</h3>
                <p className="text-slate-500 text-xs">Sorted by urgency</p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {sortedByRisk.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-white/[0.02] transition-colors ${effectiveId === asset.id ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-200 text-xs font-medium truncate flex-1 mr-2">{asset.name}</span>
                      <span className={`text-xs font-bold ${asset.rul < 20 ? 'text-red-400' : asset.rul < 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ~{asset.rul}d
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={10} className="text-slate-600" />
                      <span className="text-slate-600 text-[10px]">
                        {asset.rul < 20 ? 'Act now' : asset.rul < 60 ? 'Schedule soon' : 'Monitor'}
                      </span>
                      {asset.impact > 0 && (
                        <span className="text-red-400 text-[10px] ml-auto">{asset.impact.toLocaleString()} BOPD</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Decline curve */}
          <div className="col-span-12 md:col-span-8 space-y-4">
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm">{selected.name} — Health Projection (90 days)</h3>
              <p className="text-slate-500 text-xs mb-4">
                Current health: {selected.healthScore} · Est. RUL: ~{rulDays} days · Degradation: ~{degradeRate} pts/day
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={projectionData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
                  <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false}
                    label={{ value: 'Days from now', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 10 }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Degraded threshold', fill: '#f59e0b', fontSize: 9 }} />
                  <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical threshold', fill: '#ef4444', fontSize: 9 }} />
                  <Line type="monotone" dataKey="projected" name="No intervention" stroke="#ef4444" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="withMaintenance" name="With maintenance (day 30)" stroke="#10b981" dot={false} strokeWidth={2} strokeDasharray="6 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Early warning panel */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <TrendingDown size={15} className="text-amber-400" />
                Fastest Degrading Assets (7-day window)
              </h3>
              <div className="space-y-2">
                {ASSETS.filter(a => a.status !== 'healthy').map(a => {
                  const rate = a.status === 'critical' ? 1.8 : 0.6
                  const alert = openAlerts.find(al => al.assetId === a.id)
                  return (
                    <div key={a.id} className="flex items-center gap-3 text-xs">
                      <AlertTriangle size={12} className={a.status === 'critical' ? 'text-red-400' : 'text-amber-400'} />
                      <span className="text-slate-300 flex-1">{a.name}</span>
                      <span className="text-slate-500">{rate} pts/day</span>
                      <span className={`font-medium ${a.status === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                        {a.status}
                      </span>
                      {alert && (
                        <span className="text-slate-600">~{getRUL(a)}d to failure</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
