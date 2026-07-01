import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_HOME = {
  admin: '/admin',
  finance: '/finance',
  teacher: '/teacher',
  parent: '/parent',
  student: '/student',
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, userProfile } = useAuth()

  if (!currentUser) return <Navigate to="/login" replace />

  const role = userProfile?.role
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/login'} replace />
  }

  return children
}

export function DeveloperRoute({ children }) {
  const { currentUser, userProfile } = useAuth()
  if (!currentUser || !userProfile?.isDeveloper) return <Navigate to="/login" replace />
  return children
}
