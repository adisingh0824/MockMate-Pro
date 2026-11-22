
// client/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('mm_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => localStorage.getItem('mm_token') || null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('mm_token')))

  useEffect(() => {
    let active = true
    const fetchUser = async () => {
      if (!token) {
        if (active) {
          setUser(null)
          setLoading(false)
        }
        return
      }
      setLoading(true)
      try {
        const res = await authAPI.getMe()
        if (active && res?.data?.user) {
          setUser(res.data.user)
          localStorage.setItem('mm_user', JSON.stringify(res.data.user))
        }
      } catch (err) {
        const status = err.response?.status
        const message = err.response?.data?.message?.toLowerCase() || ''
        if (active && (status === 401 || status === 404 || (status === 403 && message.includes('verify your email')))) {
          logout()
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchUser()
    return () => { active = false }
  }, [token])

  const login = (newToken, userData) => {
    if (!newToken) {
      throw new Error('Token is required for login')
    }
    localStorage.setItem('mm_token', newToken)
    if (userData) {
      localStorage.setItem('mm_user', JSON.stringify(userData))
      setUser(userData)
    }
    setLoading(true)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('mm_token')
    localStorage.removeItem('mm_user')
    import('firebase/auth')
      .then(({ signOut }) => import('../firebase').then(({ auth }) => signOut(auth)))
      .catch(() => {})
    setToken(null)
    setUser(null)
    setLoading(false)
  }

  const updateUser = (data) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...data }
      localStorage.setItem('mm_user', JSON.stringify(nextUser))
      return nextUser
    })
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export default AuthContext
