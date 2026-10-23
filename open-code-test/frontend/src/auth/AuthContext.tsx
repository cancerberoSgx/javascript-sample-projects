import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import {
  api,
  clearImpersonatorSession,
  clearToken,
  getImpersonatorSession,
  getToken,
  setImpersonatorSession,
  setToken,
} from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  impersonator: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  impersonate: (organizationId: number, userId: number) => Promise<void>
  stopImpersonating: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [impersonator, setImpersonator] = useState<User | null>(
    () => getImpersonatorSession()?.user ?? null,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    if (!getToken()) {
      clearImpersonatorSession()
      setImpersonator(null)
      setLoading(false)
      return
    }

    api
      .me()
      .then((currentUser) => {
        if (active) {
          const session = getImpersonatorSession()
          if (
            currentUser.role === 'root' ||
            !session ||
            session.targetUserId !== currentUser.id
          ) {
            clearImpersonatorSession()
            setImpersonator(null)
          } else {
            setImpersonator(session.user)
          }
          setUser(currentUser)
        }
      })
      .catch(() => {
        clearToken()
        clearImpersonatorSession()
        if (active) {
          setUser(null)
          setImpersonator(null)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      clearToken()
      clearImpersonatorSession()
      setUser(null)
      setImpersonator(null)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password)
    clearImpersonatorSession()
    setImpersonator(null)
    setToken(response.access_token)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    clearImpersonatorSession()
    setUser(null)
    setImpersonator(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.me())
    } catch {
      // A 401 response clears the session via the auth:unauthorized event.
    }
  }, [])

  const impersonate = useCallback(
    async (organizationId: number, userId: number) => {
      const token = getToken()
      if (!token || !user) {
        throw new Error('You need to be signed in to impersonate a user')
      }

      const response = await api.impersonateUser(organizationId, userId)
      setImpersonatorSession({
        token,
        user,
        targetUserId: response.user.id,
      })
      setToken(response.access_token)
      setUser(response.user)
      setImpersonator(user)
    },
    [user],
  )

  const stopImpersonating = useCallback(async () => {
    const session = getImpersonatorSession()
    if (!session) {
      return
    }

    setToken(session.token)
    clearImpersonatorSession()
    setUser(session.user)
    setImpersonator(null)

    try {
      setUser(await api.me())
    } catch {
      clearToken()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      impersonator,
      loading,
      login,
      logout,
      refreshUser,
      impersonate,
      stopImpersonating,
    }),
    [
      user,
      impersonator,
      loading,
      login,
      logout,
      refreshUser,
      impersonate,
      stopImpersonating,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
