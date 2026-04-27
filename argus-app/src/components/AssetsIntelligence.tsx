import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Send, Sparkles, Loader2, RotateCcw, Wrench } from 'lucide-react'
import { useIntelligence } from '../context/IntelligenceContext'
import { api } from '../services/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsUsed?: string[]
  error?: boolean
}

const SUGGESTED = [
  'Which assets are at highest risk right now?',
  'Show me open alerts and their financial exposure',
  'What maintenance is overdue or coming up?',
  'Which sensors are showing abnormal readings?',
  'Summarise the current fleet health',
]

const PAGE_LABELS: Record<string, string> = {
  '/':                 'Overview Dashboard',
  '/assets':           'Assets List',
  '/alerts':           'Alerts',
  '/sensor-health':    'Sensor Health',
  '/equipment-health': 'Equipment Health',
  '/predictions':      'Predictions / RUL',
  '/maintenance':      'Maintenance Log',
  '/settings':         'Settings',
}

function ToolBadge({ name }: { name: string }) {
  const label = name.replace(/_/g, ' ')
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-medium">
      <Wrench size={9} />
      {label}
    </span>
  )
}

function AssistantMessage({ msg }: { msg: Message }) {
  return (
    <div className="space-y-2">
      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {msg.toolsUsed.map(t => <ToolBadge key={t} name={t} />)}
        </div>
      )}
      <div className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.error ? 'text-red-400' : 'text-slate-300'}`}>
        {msg.content}
      </div>
    </div>
  )
}

export default function AssetsIntelligence() {
  const { isOpen, close } = useIntelligence()
  const location = useLocation()
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)

  const pageLabel = PAGE_LABELS[location.pathname] ?? location.pathname

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  const buildContext = useCallback(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    const currentAssetId = segments[0] === 'assets' && segments[1] ? segments[1] : null
    return {
      currentPage: pageLabel,
      currentAssetId,
      currentAssetName: null,
    }
  }, [location, pageLabel])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.content }))
      const { response, tools_used } = await api.chat(apiMessages, buildContext())

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        toolsUsed: tools_used,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Unable to reach the intelligence service. Make sure the API server is running with a valid ANTHROPIC_API_KEY.',
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, buildContext])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => setMessages([])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay (mobile) */}
      <div className="fixed inset-0 z-40 bg-[var(--overlay-dark)] backdrop-blur-[1px] lg:hidden" onClick={close} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-[380px] z-50 flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-none">Assets Intelligence</p>
              <p className="text-slate-600 text-[10px] mt-0.5">{pageLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[var(--overlay-subtle)] transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              onClick={close}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[var(--overlay-subtle)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-5">
              <div className="text-center pt-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={20} className="text-violet-400" />
                </div>
                <p className="text-white text-sm font-medium">Ask me anything</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  I have live access to your assets, sensors, alerts, and maintenance data.
                </p>
              </div>
              <div className="space-y-2">
                {SUGGESTED.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-blue-500/30 hover:bg-blue-500/5 text-slate-400 hover:text-slate-200 text-xs transition-colors leading-relaxed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-blue-600/25 border border-blue-500/20 text-slate-200 text-sm leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[95%] space-y-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <span className="text-slate-600 text-[10px] font-medium">Intelligence</span>
                  </div>
                  <AssistantMessage msg={msg} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={10} className="text-white" />
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <Loader2 size={12} className="animate-spin text-violet-400" />
                  Analysing…
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3.5 border-t border-[var(--border)] flex-shrink-0">
          <div className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border)] focus-within:border-blue-500/40 rounded-xl px-3 py-2 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about assets, alerts, sensors…"
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none max-h-28 leading-relaxed disabled:opacity-50"
              style={{ scrollbarWidth: 'none' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors mb-0.5"
            >
              <Send size={12} className="text-white" />
            </button>
          </div>
          <p className="text-slate-700 text-[10px] mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  )
}
