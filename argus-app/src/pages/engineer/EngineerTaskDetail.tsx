import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import type { WorkOrder } from '../../context/WorkOrderContext'
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle, Clock, Calendar, ClipboardList } from 'lucide-react'
import { useToast } from '../../components/Toast'

const STATUS_OPTIONS = [
  { value: 'confirmed',   label: 'Open',        color: 'border-blue-500/50 bg-blue-600/20 text-blue-300' },
  { value: 'in_progress', label: 'In Progress',  color: 'border-amber-500/50 bg-amber-600/20 text-amber-300' },
  { value: 'completed',   label: 'Close Task',   color: 'border-emerald-500/50 bg-emerald-600/20 text-emerald-300' },
]

const priorityColor: Record<string, string> = {
  emergency: 'text-red-400',
  high:      'text-orange-400',
  medium:    'text-amber-400',
  low:       'text-blue-400',
}

export default function EngineerTaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [task, setTask]           = useState<WorkOrder | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')
  const [notes, setNotes]         = useState('')

  useEffect(() => {
    if (!id) return
    api.workOrders.get(id)
      .then(row => {
        const wo = api.workOrders.transform(row)
        setTask(wo)
        setNewStatus(wo.status)
        setNotes(wo.fieldNotes ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!task || !id) return
    setSaving(true)
    try {
      const updated = await api.workOrders.updateStatus(id, newStatus, notes)
      const wo = api.workOrders.transform(updated)
      setTask(wo)
      setNotes(wo.fieldNotes ?? '')
      toast.success(newStatus === 'completed' ? 'Task closed successfully' : 'Task updated')
    } catch {
      toast.error('Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60'

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading task...
      </div>
    )
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center text-slate-500">
        Task not found.
      </div>
    )
  }

  const hasChanges = newStatus !== task.status || notes !== (task.fieldNotes ?? '')

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Top bar */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-5 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/engineer')} className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <p className="text-white text-sm font-semibold">{task.assetName}</p>
          <p className="text-slate-500 text-xs">{task.id}</p>
        </div>
      </div>

      <div className="p-5 max-w-2xl mx-auto space-y-5">
        {/* Priority + type badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold uppercase ${priorityColor[task.priority]}`}>
            ● {task.priority} priority
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 text-xs capitalize">{task.type.replace('-', ' ')}</span>
          {task.targetDate && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 text-xs flex items-center gap-1">
                <Calendar size={10} /> Due {task.targetDate}
              </span>
            </>
          )}
        </div>

        {/* Title + description */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ClipboardList size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
            <p className="text-white text-sm font-semibold leading-snug">{task.title}</p>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          {task.estimatedDowntimeHours > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Est. Duration</p>
              <p className="text-white text-sm font-semibold flex items-center gap-1">
                <Clock size={12} className="text-slate-400" /> {task.estimatedDowntimeHours}h
              </p>
            </div>
          )}
          {task.estimatedImpactBopd > 0 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-3">
              <p className="text-slate-500 text-[10px] uppercase tracking-wide mb-1">Production at Risk</p>
              <p className="text-white text-sm font-semibold flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-400" /> {task.estimatedImpactBopd} BOPD
              </p>
            </div>
          )}
        </div>

        {/* Status update */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 space-y-4">
          <p className="text-white text-sm font-semibold">Update Task Status</p>
          <div className="grid grid-cols-3 gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setNewStatus(opt.value)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                  newStatus === opt.value
                    ? opt.color
                    : 'border-[var(--border)] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Field notes */}
          <div>
            <label className="text-slate-400 text-xs block mb-1.5">
              Field Notes & Observations
              {newStatus === 'completed' && <span className="text-amber-400 ml-1">(required to close)</span>}
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe what you found, what was done, and the outcome..."
              className={`${inputCls} resize-none leading-relaxed`}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges || (newStatus === 'completed' && !notes.trim())}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {saving ? 'Saving...' : 'Save Update'}
          </button>
        </div>

        {/* Existing field notes (read-only if already saved) */}
        {task.status === 'completed' && task.fieldNotes && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wide mb-2">Closure Notes</p>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{task.fieldNotes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
