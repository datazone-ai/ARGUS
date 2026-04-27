export type BadgeColor = 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'violet' | 'slate'

export interface ContextSources {
  assetData: boolean
  sensorReadings: boolean
  alerts: boolean
  maintenanceHistory: boolean
  cases: boolean
  workOrders: boolean
  documents: boolean
  uploadedContext: boolean
}

export const DEFAULT_CONTEXT_SOURCES: ContextSources = {
  assetData: true,
  sensorReadings: true,
  alerts: true,
  maintenanceHistory: true,
  cases: true,
  workOrders: true,
  documents: true,
  uploadedContext: true,
}

export interface UploadedFile {
  id: string
  name: string
  size: number
  content: string
  uploadedAt: string
}

export interface ChatSource {
  type: 'asset' | 'alert' | 'maintenance' | 'sensor' | 'workOrder' | 'case' | 'document' | 'uploaded'
  label: string
  count: number
  details?: string
}

export interface CasePreview {
  title: string
  assetName: string
  assetId: string
  linkedWell?: string | null
  priority: 'emergency' | 'high' | 'medium' | 'low'
  description: string
  issueSummary: string
  evidence: string[]
  recommendedTeam: string
  suggestedDueDate: string
  sourceAlertId?: string
}

export interface WorkOrderPreview {
  title: string
  assetName: string
  assetId: string
  linkedWell?: string | null
  priority: 'emergency' | 'high' | 'medium' | 'low'
  maintenanceType: string
  description: string
  issueSummary: string
  taskList: string[]
  requiredTeam: string
  suggestedDueDate: string
}

export type Section =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'kv'; pairs: { key: string; value: string; badge?: { text: string; color: BadgeColor } }[] }
  | { type: 'badge-row'; label?: string; badges: { text: string; color: BadgeColor }[] }
  | { type: 'divider' }
  | { type: 'case-preview'; preview: CasePreview }
  | { type: 'work-order-preview'; preview: WorkOrderPreview }
  | { type: 'insufficient'; message: string }

export interface AIResponse {
  sections: Section[]
  sources: ChatSource[]
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
  missingInfo: string[]
  reasoning: string
  suggestedFollowUps: string[]
  thinkingLabels: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AIResponse
  timestamp: string
  uploadedFiles?: UploadedFile[]
  createdRecordId?: string
  createdRecordType?: 'case' | 'work-order'
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  lastMessageAt: string
  lastMessagePreview: string
  messages: ChatMessage[]
  uploadedFiles: UploadedFile[]
  enabledSources: ContextSources
}
