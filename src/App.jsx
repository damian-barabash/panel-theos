import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Shell from './pages/Shell'
import Logs from './pages/Logs'
import PromptMaster from './pages/PromptMaster'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Shell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/prompts" replace />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/prompts" element={<PromptMaster />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/prompts" replace />} />
      </Routes>
    </ToastProvider>
  )
}
