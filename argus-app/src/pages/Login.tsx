import { useState } from 'react'
import { useAuth, ENGINEERS } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'
import { LogIn, ChevronDown } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [role, setRole] = useState<UserRole>('manager')
  const [engineerId, setEngineerId] = useState(ENGINEERS[0].id)

  const handleLogin = () => {
    if (role === 'manager') {
      login({ role: 'manager', name: 'Operations Manager' })
    } else {
      const eng = ENGINEERS.find(e => e.id === engineerId)!
      login({ role: 'engineer', name: eng.name, engineer: eng })
    }
  }

  const inputCls = 'w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60'

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">AR</span>
          </div>
          <h1 className="text-white text-2xl font-bold">ARGUS</h1>
          <p className="text-slate-500 text-sm mt-1">Predictive Asset Intelligence</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold text-sm">Sign in to your portal</h2>

          {/* Role selector */}
          <div>
            <label className="text-slate-400 text-xs block mb-2">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['manager', 'engineer'] as UserRole[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    role === r
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'bg-[var(--bg-input)] border-[var(--border)] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {r === 'manager' ? 'Ops Manager' : 'Field Engineer'}
                </button>
              ))}
            </div>
          </div>

          {/* Engineer selector */}
          {role === 'engineer' && (
            <div>
              <label className="text-slate-400 text-xs block mb-2">Select Engineer</label>
              <div className="relative">
                <select
                  value={engineerId}
                  onChange={e => setEngineerId(e.target.value)}
                  className={`${inputCls} appearance-none pr-8 cursor-pointer`}
                >
                  {ENGINEERS.map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.specialisation}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Manager name display */}
          {role === 'manager' && (
            <div>
              <label className="text-slate-400 text-xs block mb-2">Account</label>
              <div className={`${inputCls} text-slate-500`}>Operations Manager — Bonny Terminal</div>
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            <LogIn size={14} />
            Sign In
          </button>
        </div>

        <p className="text-slate-700 text-xs text-center mt-4">
          Nigerian O&G Asset Monitoring · Bonny · Brass · OML-79
        </p>
      </div>
    </div>
  )
}
