import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAssets } from '../context/AssetsContext'
import { useAlerts } from '../context/AlertsContext'
import { useMaintenance } from '../context/MaintenanceContext'
import type { SensorReading } from '../types'
import TopBar from '../components/layout/TopBar'
import AlertCard from '../components/cards/AlertCard'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { format, subDays, parseISO } from 'date-fns'

const tabs = ['Overview', 'Sensor Health', 'Alerts', 'Predictions', 'Maintenance Log']

const statusConfig = {
  healthy:  { label: 'Healthy',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  degraded: { label: 'Degraded', color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
  critical: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' },
  offline:  { label: 'Offline',  color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30' },
}

function SensorChart({ sensor, days = 7 }: { sensor: any, days?: number }) {
  const cutoff = subDays(new Date('2024-12-31T23:00:00Z'), days)
  const data = sensor.history
    .filter((r: any) => parseISO(r.timestamp) >= cutoff)
    .filter((_: any, i: number) => i % 4 === 0)
    .map((r: any) => ({
      time: format(parseISO(r.timestamp), 'MMM d HH:mm'),
      value: r.value,
    }))

  const isWarning = sensor.status === 'warning' || sensor.status === 'critical'
  const lineColor = sensor.status === 'critical' ? '#ef4444' : sensor.status === 'warning' ? '#f59e0b' : '#3b82f6'

  return (
    <div className="bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white text-sm font-medium">{sensor.name}</p>
          <p className="text-slate-500 text-xs">{sensor.id} · {sensor.unit}</p>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${isWarning ? (sensor.status === 'critical' ? 'text-red-400' : 'text-amber-400') : 'text-white'}`}>
            {sensor.currentValue.toLocaleString()} <span className="text-xs text-slate-500">{sensor.unit}</span>
          </p>
          <p className="text-slate-500 text-xs">Baseline: {sensor.baseline} {sensor.unit}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
          <XAxis dataKey="time" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 4)} />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <ReferenceLine y={sensor.baseline} stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Baseline', fill: '#3b82f6', fontSize: 9, position: 'insideTopRight' }} />
          <ReferenceLine y={sensor.hiAlarm} stroke="#ef4444" strokeDasharray="2 2" strokeWidth={1} />
          <Line type="monotone" dataKey="value" stroke={lineColor} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('Overview')
  const [sensorDays, setSensorDays] = useState(7)
  const [sensorHistories, setSensorHistories] = useState<Record<string, SensorReading[]>>({})

  const { getAssetById, fetchSensorHistory } = useAssets()
  const { getAlerts } = useAlerts()
  const { getByAsset } = useMaintenance()

  const asset = getAssetById(id!)

  useEffect(() => {
    if (activeTab !== 'Sensor Health' || !asset) return
    const hours = sensorDays * 24
    Promise.all(
      asset.sensors.map(s =>
        fetchSensorHistory(asset.id, s.id, hours).then(h => ({ id: s.id, h }))
      )
    ).then(results => {
      const map: Record<string, SensorReading[]> = {}
      results.forEach(({ id: sid, h }) => { map[sid] = h })
      setSensorHistories(map)
    }).catch(() => {})
  }, [activeTab, sensorDays, asset, fetchSensorHistory])

  if (!asset) return (
    <div className="p-8 text-slate-400">Asset not found. <Link to="/assets" className="text-blue-400">Back to assets</Link></div>
  )

  const assetAlerts = getAlerts().filter(a => a.assetId === asset.id)
  const maintenance = getByAsset(asset.id)
  const cfg = statusConfig[asset.status]

  const topFailure = asset.failureModes.sort((a, b) => b.probability - a.probability)[0]
  const rulDays = asset.status === 'critical'
    ? Math.round(assetAlerts[0]?.timeToFailureMin ?? 10)
    : asset.status === 'degraded' ? 45 : 120

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={asset.name} subtitle={`${asset.location} · ${asset.id}`} />

      <div className="p-6 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link to="/assets" className="hover:text-blue-400 flex items-center gap-1 transition-colors">
            <ArrowLeft size={12} /> Assets
          </Link>
          <span>·</span>
          <span className="text-slate-300">{asset.name}</span>
        </div>

        {/* Header info cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Status', value: <span className={cfg.color}>{cfg.label}</span> },
            { label: 'Health Score', value: <span className={asset.healthScore >= 80 ? 'text-emerald-400' : asset.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}>{asset.healthScore} / 100</span> },
            { label: 'Open Alerts', value: <span className="text-white">{assetAlerts.filter(a => a.status === 'open').length}</span> },
            { label: 'Est. RUL', value: <span className={rulDays < 20 ? 'text-red-400' : rulDays < 60 ? 'text-amber-400' : 'text-emerald-400'}>{rulDays}d</span> },
            { label: 'Operating Hours', value: <span className="text-white">{asset.operatingHours.toLocaleString()} h</span> },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 py-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-blue-400 border-blue-400'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* TAB: Overview */}
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-7 space-y-4">
              {/* Asset Info */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-white font-semibold text-sm mb-3">Asset Information</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  {[
                    ['Manufacturer', asset.manufacturer],
                    ['Type', asset.type.charAt(0).toUpperCase() + asset.type.slice(1)],
                    ['Rated Capacity', asset.ratedCapacity],
                    ['Facility', asset.facility],
                    ['Associated Well', asset.associatedWell ?? '—'],
                    ['Parent Asset', asset.parentAsset ?? '—'],
                    ['Install Date', asset.installDate],
                    ['Last Maintenance', asset.lastMaintenance],
                    ['Next Scheduled Maint.', asset.nextScheduledMaintenance],
                  ].map(([label, val]) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-200 font-medium mt-0.5">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Physics Deviation */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-white font-semibold text-sm mb-3">Physics Deviation — Key Sensors</h3>
                <div className="space-y-2">
                  {asset.sensors.slice(0, 4).map(sensor => {
                    const delta = sensor.currentValue - sensor.baseline
                    const pct = Math.abs(delta / sensor.baseline * 100)
                    const isWarning = sensor.status !== 'normal'
                    return (
                      <div key={sensor.id} className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400 w-40 truncate">{sensor.name}</span>
                        <span className="text-white font-mono w-24 text-right">
                          {sensor.currentValue.toLocaleString()} {sensor.unit}
                        </span>
                        <span className="text-slate-600 w-28 text-right font-mono">
                          baseline: {sensor.baseline}
                        </span>
                        <span className={`w-20 text-right font-mono font-bold ${isWarning ? (delta > 0 ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'}`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)} ({pct.toFixed(1)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5 space-y-4">
              {/* Failure Mode Breakdown */}
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-white font-semibold text-sm mb-3">Failure Mode Probability</h3>
                <div className="space-y-3">
                  {asset.failureModes.map(fm => (
                    <div key={fm.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium">{fm.name}</span>
                        <span className={`font-bold ${fm.probability > 0.6 ? 'text-red-400' : fm.probability > 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {Math.round(fm.probability * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${fm.probability * 100}%`,
                            background: fm.probability > 0.6 ? '#ef4444' : fm.probability > 0.3 ? '#f59e0b' : '#10b981'
                          }}
                        />
                      </div>
                      <p className="text-slate-600 text-[10px] mt-0.5">{fm.contributingFactor}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Actions */}
              {assetAlerts.filter(a => a.status === 'open').length > 0 && (
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-white font-semibold text-sm mb-3">Recommended Actions</h3>
                  <div className="space-y-3">
                    {assetAlerts.filter(a => a.status === 'open').map(a => (
                      <div key={a.id} className={`p-3 rounded-lg border text-xs ${
                        a.severity === 'critical' ? 'bg-red-950/30 border-red-500/20' :
                        a.severity === 'high' ? 'bg-orange-950/30 border-orange-500/20' :
                        'bg-amber-950/20 border-amber-500/20'
                      }`}>
                        <p className={`font-semibold mb-1 ${
                          a.severity === 'critical' ? 'text-red-400' : a.severity === 'high' ? 'text-orange-400' : 'text-amber-400'
                        }`}>{a.severity.toUpperCase()}</p>
                        <p className="text-slate-300 leading-relaxed">{a.recommendedAction.slice(0, 200)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Sensor Health */}
        {activeTab === 'Sensor Health' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setSensorDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sensorDays === d ? 'bg-blue-600 text-white' : 'bg-[var(--bg-surface)] border border-[var(--border)] text-slate-400 hover:text-slate-200'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {asset.sensors.map(sensor => (
                <SensorChart
                  key={sensor.id}
                  sensor={{ ...sensor, history: sensorHistories[sensor.id] ?? sensor.history }}
                  days={sensorDays}
                />
              ))}
            </div>
          </div>
        )}

        {/* TAB: Alerts */}
        {activeTab === 'Alerts' && (
          <div className="space-y-4">
            {assetAlerts.length === 0 ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 text-center text-slate-500 text-sm">
                No alerts for this asset.
              </div>
            ) : (
              assetAlerts.map(a => <AlertCard key={a.id} alert={a} />)
            )}
          </div>
        )}

        {/* TAB: Predictions */}
        {activeTab === 'Predictions' && (
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-8">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-white font-semibold text-sm mb-4">Health Score Projection (90 days)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={Array.from({ length: 90 }, (_, i) => {
                      const current = asset.healthScore
                      const degradeRate = asset.status === 'critical' ? 1.8 : asset.status === 'degraded' ? 0.6 : 0.2
                      const projected = Math.max(0, current - degradeRate * i)
                      const withMaint = i > 30 ? Math.min(95, projected + 25) : projected
                      return { day: `+${i}d`, projected: parseFloat(projected.toFixed(1)), withMaintenance: parseFloat(withMaint.toFixed(1)) }
                    })}
                    margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2840" />
                    <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} interval={14} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" />
                    <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="projected" name="No intervention" stroke="#ef4444" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="withMaintenance" name="With maintenance (30d)" stroke="#10b981" dot={false} strokeWidth={2} strokeDasharray="6 3" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="col-span-12 md:col-span-4 space-y-4">
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
                <h3 className="text-white font-semibold text-sm">Prediction Summary</h3>
                {[
                  { label: 'Current Health', value: `${asset.healthScore}/100`, color: asset.healthScore >= 80 ? 'text-emerald-400' : asset.healthScore >= 60 ? 'text-amber-400' : 'text-red-400' },
                  { label: 'Est. RUL', value: `${rulDays} days`, color: rulDays < 20 ? 'text-red-400' : 'text-amber-400' },
                  { label: 'Top Risk', value: topFailure?.name ?? '—', color: 'text-red-400' },
                  { label: 'Risk Probability', value: topFailure ? `${Math.round(topFailure.probability * 100)}%` : '—', color: 'text-orange-400' },
                  { label: 'Degradation Rate', value: asset.status === 'critical' ? '~1.8 pts/day' : asset.status === 'degraded' ? '~0.6 pts/day' : '~0.2 pts/day', color: 'text-slate-300' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">{label}</span>
                    <span className={`font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Maintenance Log */}
        {activeTab === 'Maintenance Log' && (
          <div className="space-y-3">
            {maintenance.length === 0 ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-8 text-center text-slate-500 text-sm">
                No maintenance records found.
              </div>
            ) : (
              maintenance.map(m => (
                <div key={m.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        m.type === 'overhaul' ? 'bg-purple-500/20 text-purple-400' :
                        m.type === 'corrective' ? 'bg-red-500/20 text-red-400' :
                        m.type === 'inspection' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                      </span>
                      <span className="text-white text-sm font-medium">{m.date}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{m.duration}h · {m.technician}</span>
                  </div>
                  <p className="text-slate-400 text-xs mb-2"><span className="text-slate-500 font-medium">Findings: </span>{m.findings}</p>
                  <p className="text-slate-400 text-xs"><span className="text-slate-500 font-medium">Outcome: </span>{m.outcome}</p>
                  <p className="text-slate-600 text-[10px] mt-2">Next due: {m.nextDue}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
