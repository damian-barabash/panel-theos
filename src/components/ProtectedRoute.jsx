import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo } from './Logo'
import { Spinner } from './ui'

export function ProtectedRoute({ children }) {
  const { hasAccess, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5">
        <Logo height={48} />
        <Spinner className="h-6 w-6" />
      </div>
    )
  }
  if (!hasAccess) return <Navigate to="/login" replace />
  return children
}
