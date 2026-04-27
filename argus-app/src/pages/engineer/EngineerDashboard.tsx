import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import type { WorkOrder } from '../../context/WorkOrderContext'
import TopBar from '../../components/layout/TopBar'
import { ClipboardList, Calendar, Clock, ChevronRight, Loader2 } from 'lucide-react'

const statusConfig = {
  confirmed:   { label: 'Open',        color: 'text-blue-400',    bg: 'bg-blue-500/15',    dot: 'bg-blue-400' },
  in_progress: { label: 'In Progress', color: 'text-amber-400',   bg: 'bg-amber-500/15',   dot: 'bg-amber-400' },
  completed:   { label: 'Closed',      color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-500',   bg: 'bg-slate-500/10',   dot: 'bg-slate-500' },
}

const priorityColor: Record<string, string> = {
  emergency: 'text-red-400 bg-red-500/10',
  high:      'text-orange-400 bg-orange-500/10',
  medium:    'text-amber-400 bg-amber-500/10',
  low:       'text-blue-400 bg-blue-500/10',
}

export default function EngineerDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks]   = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.name) return
    api.workOrders.list({ assigned_to: user.name })
      .then(rows => { setTasks(rows.map(api.workOrders.transform)); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user])

  const open       = tasks.filter(t => t.status === 'confirmed')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const closed     = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled')

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        title="My Tasks"
        subtitle={`${user?.name} · ${user?.engineer?.specialisation} · ${open.length + inProgress.length} active`}
      />
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Summary pills */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Open',        count: open.length,       color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'In Progress', count: inProgress.length, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Closed',      count: closed.length,     color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border ${s.bg} px-4 py-3 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Task list */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-12 text-center">
            <ClipboardList size={32} className="mx-auto mb-3 text-slate-600" />
            <p className="text-slate-500 text-sm">No tasks assigned to you yet.</p>
            <p className="text-slate-600 text-xs mt-1">Tasks will appear here when an Operations Manager assigns work orders to you.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...open, ...inProgress, ...closed].map(task => {
              const st = statusConfig[task.status] ?? statusConfig.confirmed
              const pr = priorityColor[task.priority] ?? priorityColor.medium
              return (
                <button
                  key={task.id}
                  onClick={() => navigate(`/engineer/task/${task.id}`)}
                  className="w-full text-left bg-[var(--bg-surface)] border border-[var(--border)] hover:border-blue-500/30 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-orange-500/10 flex-shrink-0">
                        <ClipboardList size={14} className="text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{task.assetName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pr}`}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 flex-shrink-0 mt-1" />
                  </div>
                  <p className="text-slate-300 text-xs mt-2.5 font-medium leading-snug line-clamp-1">{task.title}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {task.targetDate && (
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Calendar size={10} /> Due: {task.targetDate}
                      </span>
                    )}
                    {task.estimatedDowntimeHours > 0 && (
                      <span className="text-slate-500 text-xs flex items-center gap-1">
                        <Clock size={10} /> {task.estimatedDowntimeHours}h est.
                      </span>
                    )}
                    <span className="text-slate-600 text-[10px] ml-auto">{task.id}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
