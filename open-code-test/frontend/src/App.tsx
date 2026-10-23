import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './auth/AuthContext'
import { ProtectedLayout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { OrganizationDetailPage } from './pages/OrganizationDetailPage'
import { OrganizationsPage } from './pages/OrganizationsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/organizations" replace />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route
              path="/organizations/:organizationId"
              element={<OrganizationDetailPage />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/organizations" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
