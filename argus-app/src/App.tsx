import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AlertsProvider } from './context/AlertsContext'
import { AssetsProvider } from './context/AssetsContext'
import { MaintenanceProvider } from './context/MaintenanceContext'
import { WorkOrderProvider } from './context/WorkOrderContext'
import { IntelligenceProvider } from './context/IntelligenceContext'
import { LayoutProvider, useLayout } from './context/LayoutContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import WorkOrderModal from './components/modals/WorkOrderModal'
import AssetsIntelligence, { IntelligenceFloatBtn } from './components/AssetsIntelligence'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Assets from './pages/Assets'
import AssetDetail from './pages/AssetDetail'
import Alerts from './pages/Alerts'
import SensorHealth from './pages/SensorHealth'
import EquipmentHealth from './pages/EquipmentHealth'
import Predictions from './pages/Predictions'
import MaintenanceLog from './pages/MaintenanceLog'
import Production from './pages/Production'
import Settings from './pages/Settings'
import EngineerDashboard from './pages/engineer/EngineerDashboard'
import EngineerTaskDetail from './pages/engineer/EngineerTaskDetail'
import type { ReactNode } from 'react'

function SharedProviders({ children }: { children: ReactNode }) {
  return (
    <AssetsProvider>
      <AlertsProvider>
        <MaintenanceProvider>
          <WorkOrderProvider>
            <IntelligenceProvider>
              <LayoutProvider>
                {children}
              </LayoutProvider>
            </IntelligenceProvider>
          </WorkOrderProvider>
        </MaintenanceProvider>
      </AlertsProvider>
    </AssetsProvider>
  )
}

function ManagerLayout() {
  const { sidebarExpanded } = useLayout()
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />
      <main className={`flex-1 min-h-screen overflow-x-hidden transition-[margin] duration-200 ${sidebarExpanded ? 'ml-56' : 'ml-16'}`}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/sensor-health" element={<SensorHealth />} />
          <Route path="/equipment-health" element={<EquipmentHealth />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/maintenance" element={<MaintenanceLog />} />
          <Route path="/production" element={<Production />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <WorkOrderModal />
      <AssetsIntelligence />
      <IntelligenceFloatBtn />
    </div>
  )
}

function ManagerApp() {
  return (
    <SharedProviders>
      <ManagerLayout />
    </SharedProviders>
  )
}

function EngineerLayout() {
  const { sidebarExpanded } = useLayout()
  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />
      <main className={`flex-1 min-h-screen overflow-x-hidden transition-[margin] duration-200 ${sidebarExpanded ? 'ml-56' : 'ml-16'}`}>
        <Routes>
          <Route path="/engineer" element={<EngineerDashboard />} />
          <Route path="/engineer/task/:id" element={<EngineerTaskDetail />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/sensor-health" element={<SensorHealth />} />
          <Route path="/equipment-health" element={<EquipmentHealth />} />
          <Route path="/maintenance" element={<MaintenanceLog />} />
          <Route path="/production" element={<Production />} />
          <Route path="*" element={<Navigate to="/engineer" replace />} />
        </Routes>
      </main>
      <AssetsIntelligence />
      <IntelligenceFloatBtn />
    </div>
  )
}

function EngineerApp() {
  return (
    <SharedProviders>
      <EngineerLayout />
    </SharedProviders>
  )
}

function AppRouter() {
  const { user } = useAuth()
  if (!user) return <Routes><Route path="*" element={<Login />} /></Routes>
  if (user.role === 'engineer') return <EngineerApp />
  return <ManagerApp />
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
