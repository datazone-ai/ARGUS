import TopBar from '../components/layout/TopBar'
import { useAssets } from '../context/AssetsContext'
import { Link } from 'react-router-dom'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { useState } from 'react'

const statusDot: Record<string, string> = { healthy: 'bg-emerald-500', degraded: 'bg-amber-400', critical: 'bg-red-500', offline: 'bg-slate-500' }
const statusText: Record<string, string> = { healthy: 'text-emerald-400', degraded: 'text-amber-400', critical: 'text-red-400', offline: 'text-slate-400' }

export default function EquipmentHealth() {
  const { assets: ASSETS } = useAssets()
  const [selectedId, setSelectedId] = useState('')
  const selected = ASSETS.find(a => a.id === (selectedId || ASSETS[0]?.id))

  if (!selected) return null

  const radarData = selected.sensors.slice(0, 6).map(s => {
    const score = Math.max(0, 100 - Math.abs((s.currentValue - s.baseline) / s.baseline) * 200)
    return { sensor: s.name.split(' ').slice(0, 2).join(' '), score: parseFloat(score.toFixed(0)) }
  })

  const sorted = [...ASSETS].sort((a, b) => a.healthScore - b.healthScore)
  const effectiveId = selectedId || ASSETS[0]?.id || ''

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Equipment Health" subtitle="Component-level health breakdown across all assets" />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-12 gap-5">
          {/* Sorted Asset List */}
          <div className="col-span-12 md:col-span-4 space-y-2">
            <p className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-3">Assets by Health Score</p>
            {sorted.map(asset => (
              <button
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${effectiveId === asset.id ? 'border-blue-500/50 bg-blue-500/5' : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[asset.status]}`} />
                  <span className="text-white text-xs font-medium truncate flex-1">{asset.name}</span>
                  <span className={`text-xs font-bold ${asset.healthScore >= 80 ? 'text-emerald-400' : asset.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {asset.healthScore}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${asset.healthScore}%`,
                      background: asset.healthScore >= 80 ? '#10b981' : asset.healthScore >= 60 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-slate-600 text-[10px]">{asset.type}</span>
                  <span className={`text-[10px] ${statusText[asset.status]}`}>{asset.status}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="col-span-12 md:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">{selected.name}</h2>
                <p className="text-slate-500 text-xs">{selected.location} · {selected.id}</p>
              </div>
              <Link to={`/assets/${selected.id}`} className="text-blue-400 text-xs hover:text-blue-300">
                Full Detail →
              </Link>
            </div>

            {/* Sensor radar */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-1">Sensor Health Radar</h3>
              <p className="text-slate-500 text-xs mb-4">Score = deviation from baseline (100 = no deviation)</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1e2840" />
                  <PolarAngleAxis dataKey="sensor" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar name="Health" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid #2d3748', borderRadius: '8px', fontSize: 11 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Per-sensor detail */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <h3 className="text-white font-semibold text-sm">Sensor-Level Health</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Sensor', 'Current', 'Baseline', 'Delta', 'Status', 'Hi Alarm'].map(h => (
                      <th key={h} className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.sensors.map(sensor => {
                    const delta = sensor.currentValue - sensor.baseline
                    const isPos = delta > 0
                    const isWarning = sensor.status !== 'normal'
                    return (
                      <tr key={sensor.id} className="border-b border-[var(--border)]/50">
                        <td className="px-4 py-2.5">
                          <p className="text-slate-200 text-xs font-medium">{sensor.name}</p>
                          <p className="text-slate-600 text-[10px]">{sensor.id}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-mono font-bold ${isWarning ? (sensor.status === 'critical' ? 'text-red-400' : 'text-amber-400') : 'text-white'}`}>
                            {sensor.currentValue.toLocaleString()} {sensor.unit}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{sensor.baseline} {sensor.unit}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-mono font-bold ${isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {isPos ? '+' : ''}{delta.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            sensor.status === 'critical' ? 'bg-red-500/20 text-red-400' :
                            sensor.status === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {sensor.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{sensor.hiAlarm} {sensor.unit}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Failure mode breakdown */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-white font-semibold text-sm mb-3">Failure Mode Probability</h3>
              <div className="space-y-3">
                {selected.failureModes.map(fm => (
                  <div key={fm.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{fm.name}</span>
                      <span className={`font-bold ${fm.probability > 0.6 ? 'text-red-400' : fm.probability > 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {Math.round(fm.probability * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
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
          </div>
        </div>
      </div>
    </div>
  )
}
