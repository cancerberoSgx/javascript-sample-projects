import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Button } from './Button'
import { Loading } from './Loading'
import { RoleBadge } from './RoleBadge'

export function ProtectedLayout() {
  const { user, impersonator, loading, logout, stopImpersonating } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="Loading your session..." />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="min-h-screen">
      {impersonator && (
        <div className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
            <p className="text-sm text-amber-900">
              You are impersonating{' '}
              <span className="font-medium">{user.email}</span> as a member.
            </p>
            <Button
              variant="secondary"
              onClick={() => void stopImpersonating()}
            >
              Return to {impersonator.email}
            </Button>
          </div>
        </div>
      )}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/organizations" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              OM
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-900">
              OrgManager
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900">{user.email}</p>
              <div className="mt-0.5">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
