import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Conversation, ChatMessage, ContextSources, UploadedFile } from '../types/intelligence'
import { DEFAULT_CONTEXT_SOURCES } from '../types/intelligence'

function newConversation(): Conversation {
  return {
    id: Date.now().toString(),
    title: 'New Chat',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: '',
    messages: [],
    uploadedFiles: [],
    enabledSources: { ...DEFAULT_CONTEXT_SOURCES },
  }
}

interface IntelligenceContextValue {
  isOpen: boolean
  isFullPage: boolean
  conversations: Conversation[]
  activeId: string | null
  enabledSources: ContextSources
  open: () => void
  close: () => void
  toggle: () => void
  setFullPage: (v: boolean) => void
  setEnabledSources: (s: ContextSources) => void
  getActiveConversation: () => Conversation | null
  startNewConversation: () => void
  selectConversation: (id: string) => void
  appendMessage: (msg: ChatMessage) => void
  updateLastMessage: (patch: Partial<ChatMessage>) => void
  addUploadedFile: (file: UploadedFile) => void
  setConversationTitle: (id: string, title: string) => void
}

const IntelligenceContext = createContext<IntelligenceContextValue | null>(null)

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen]       = useState(false)
  const [isFullPage, setIsFullPage] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [enabledSources, setEnabledSources] = useState<ContextSources>({ ...DEFAULT_CONTEXT_SOURCES })

  const open   = useCallback(() => setIsOpen(true), [])
  const close  = useCallback(() => { setIsOpen(false); setIsFullPage(false) }, [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])
  const setFullPage = useCallback((v: boolean) => setIsFullPage(v), [])

  const getActiveConversation = useCallback((): Conversation | null => {
    if (!activeId) return null
    return conversations.find(c => c.id === activeId) ?? null
  }, [activeId, conversations])

  const startNewConversation = useCallback(() => {
    const conv = newConversation()
    setConversations(prev => [conv, ...prev])
    setActiveId(conv.id)
  }, [])

  const selectConversation = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const appendMessage = useCallback((msg: ChatMessage) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeId) return c
      const messages = [...c.messages, msg]
      const title = c.messages.length === 0 && msg.role === 'user'
        ? msg.content.split(' ').slice(0, 5).join(' ').slice(0, 40)
        : c.title
      return {
        ...c,
        messages,
        title,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: msg.content.slice(0, 60),
      }
    }))
  }, [activeId])

  const updateLastMessage = useCallback((patch: Partial<ChatMessage>) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeId) return c
      const messages = [...c.messages]
      if (messages.length === 0) return c
      messages[messages.length - 1] = { ...messages[messages.length - 1], ...patch }
      return { ...c, messages }
    }))
  }, [activeId])

  const addUploadedFile = useCallback((file: UploadedFile) => {
    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, uploadedFiles: [...c.uploadedFiles, file] } : c
    ))
  }, [activeId])

  const setConversationTitle = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }, [])

  return (
    <IntelligenceContext.Provider value={{
      isOpen, isFullPage, conversations, activeId, enabledSources,
      open, close, toggle, setFullPage, setEnabledSources,
      getActiveConversation, startNewConversation, selectConversation,
      appendMessage, updateLastMessage, addUploadedFile, setConversationTitle,
    }}>
      {children}
    </IntelligenceContext.Provider>
  )
}

export function useIntelligence() {
  const ctx = useContext(IntelligenceContext)
  if (!ctx) throw new Error('useIntelligence must be used inside IntelligenceProvider')
  return ctx
}
