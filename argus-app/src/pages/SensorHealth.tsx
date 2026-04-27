import TopBar from '../components/layout/TopBar'
import { useAssets } from '../context/AssetsContext'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  normal:   { label: 'Normal',   color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  warning:  { label: 'Warning',  color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  critical: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/15' },
  stale:    { label: 'Stale',    color: 'text-slate-400',   bg: 'bg-slate-500/15' },
  flatline: { label: 'Flatline', color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  erratic:  { label: 'Erratic',  color: 'text-purple-400',  bg: 'bg-purple-500/15' },
}

export default function SensorHealth() {
  const { assets: ASSETS } = useAssets()
  const allSensors = ASSETS.flatMap(asset =>
    asset.sensors.map(s => ({ ...s, assetName: asset.name, assetId: asset.id }))
  )

  const counts = {
    normal: allSensors.filter(s => s.status === 'normal').length,
    warning: allSensors.filter(s => s.status === 'warning').length,
    critical: allSensors.filter(s => s.status === 'critical').length,
    stale: allSensors.filter(s => s.status === 'stale').length,
    flatline: allSensors.filter(s => s.status === 'flatline').length,
    erratic: allSensors.filter(s => s.status === 'erratic').length,
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Sensor Health" subtitle={`${allSensors.length} sensors monitored across 10 assets`} />
      <div className="p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {Object.entries(counts).map(([status, count]) => {
            const cfg = statusConfig[status]
            return (
              <div key={status} className={`${cfg.bg} border border-white/5 rounded-xl p-3`}>
                <p className="text-slate-500 text-[10px] uppercase tracking-wide">{cfg.label}</p>
                <p className={`text-xl font-bold mt-1 ${cfg.color}`}>{count}</p>
              </div>
            )
          })}
        </div>

        {/* Per-asset sensor tables */}
        {ASSETS.map(asset => (
          <div key={asset.id} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm">{asset.name}</h3>
                <p className="text-slate-500 text-xs">{asset.location} · {asset.sensors.length} sensors</p>
              </div>
              <span className={`text-xs font-bold ${asset.healthScore >= 80 ? 'text-emerald-400' : asset.healthScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                Health: {asset.healthScore}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {['Sensor ID', 'Type', 'Current Value', 'Baseline', 'Delta', 'Lo Alarm', 'Hi Alarm', 'Status', 'Last Updated'].map(h => (
                    <th key={h} className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {asset.sensors.map(sensor => {
                  const delta = sensor.currentValue - sensor.baseline
                  const cfg = statusConfig[sensor.status]
                  return (
                    <tr key={sensor.id} className="border-b border-[var(--border)]/40 hover:bg-white/[0.015]">
                      <td className="px-4 py-2.5">
                        <p className="text-slate-200 text-xs font-medium">{sensor.name}</p>
                        <p className="text-slate-600 text-[10px] font-mono">{sensor.id}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs capitalize">{sensor.type}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-mono font-bold ${sensor.status !== 'normal' ? (sensor.status === 'critical' ? 'text-red-400' : 'text-amber-400') : 'text-white'}`}>
                          {sensor.currentValue.toLocaleString()}
                        </span>
                        <span className="text-slate-600 text-[10px] ml-1">{sensor.unit}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs font-mono">{sensor.baseline}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-mono font-bold ${delta > 0 && sensor.status !== 'normal' ? 'text-red-400' : delta < 0 && sensor.status !== 'normal' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{sensor.loAlarm}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs font-mono">{sensor.hiAlarm}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-[10px] font-mono">
                        {sensor.lastUpdated.replace('T', ' ').slice(0, 16)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
