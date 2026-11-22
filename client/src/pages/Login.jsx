import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth as firebaseAuth } from '../firebase'
import toast from 'react-hot-toast'

const FEATURES = [
  'Role-specific tracks across Junior, Mid, and Senior tiers',
  'Timed algorithmic challenges and architecture scenarios',
  'Quantitative scoring measuring depth, edge cases, and clarity',
  'Detailed historical logs and progress trend analytics',
]

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M2 6l3 3 5-5" />
  </svg>
)

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [notice, setNotice] = useState(location.state?.notice || '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.email)    errs.email    = 'Email is required'
    if (!form.password) errs.password = 'Password is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    try {
      const res = await authAPI.login(form)

      const token = res?.data?.token || res?.data?.data?.token || res?.data?.accessToken || res?.data?.auth?.token
      const userData = res?.data?.user || res?.data?.data?.user || res?.data?.profile || null

      if (!token) {
        toast.error('Authentication succeeded but session token was missing')
        setLoading(false)
        return
      }

      try {
        login(token, userData)
      } catch {
        localStorage.setItem('mm_token', token)
        if (userData) localStorage.setItem('mm_user', JSON.stringify(userData))
      }

      toast.success(`Welcome back, ${userData?.name || 'user'}`)
      navigate('/dashboard')
    } catch (err) {
      // Fallback: try Firebase Auth if backend login fails
      try {
        const userCred = await signInWithEmailAndPassword(firebaseAuth, form.email.trim().toLowerCase(), form.password)
        // Verification can happen in another browser tab. Refresh Firebase's cached
        // user record before deciding whether to keep the user out.
        await userCred.user.reload()
        if (!userCred.user.emailVerified) {
          await sendEmailVerification(userCred.user)
          await signOut(firebaseAuth)
          setNotice('Your email address is not verified yet. Open the verification email we sent, click its link, then return here and sign in again. We sent a fresh link just now.')
          return
        }
        const idToken = await userCred.user.getIdToken(true)
        let token = idToken
        let userData = {
          id: userCred.user.uid,
          name: userCred.user.displayName || form.email.split('@')[0],
          email: form.email.toLowerCase(),
          isPremium: false,
        }

        try {
          const syncRes = await authAPI.firebaseSync({
            email: form.email.toLowerCase(),
            name: userData.name,
            idToken,
          })
          if (syncRes.data?.token) {
            token = syncRes.data.token
            if (syncRes.data?.user) userData = syncRes.data.user
          }
        } catch (syncErr) {
          console.warn('Backend sync deferred, continuing with Firebase credentials:', syncErr.message)
        }

        login(token, userData)
        toast.success(`Welcome back, ${userData.name}`)
        navigate('/dashboard')
        return
      } catch (fbErr) {
        console.warn('Firebase login fallback attempt failed:', fbErr.message)
        const errorMsg = err.response?.data?.message || err.message || 'Authentication failed'
        toast.error(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-stone-50">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-between p-14 bg-stone-900 text-white">
        <div>
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-7 h-7 bg-white text-stone-900 rounded flex items-center justify-center font-mono text-xs font-bold">
              M
            </div>
            <span className="font-bold text-base tracking-tight">MockMate Pro</span>
          </div>

          <div className="max-w-md">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-2">Technical Interview Prep</span>
            <h1 className="text-3xl font-bold tracking-tight text-white leading-tight mb-4">
              Standardized technical practice for engineering hiring bars.
            </h1>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed mb-10">
              Benchmark your answers against real evaluation rubrics. Practice structured drills across architecture, language internals, and live technical screens.
            </p>

            <ul className="space-y-3">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 w-4 h-4 rounded bg-stone-800 text-stone-300 flex items-center justify-center flex-shrink-0">
                    <CheckIcon />
                  </span>
                  <span className="text-stone-300 text-xs leading-normal">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-xs text-stone-500 border-t border-stone-800 pt-6 flex items-center justify-between">
          <span>Author: Aditya Singh</span>
          <span>sadityasingh7990@gmail.com</span>
        </div>
      </div>

      {/* Right Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-stone-900 text-white rounded flex items-center justify-center font-mono text-xs font-bold">
              M
            </div>
            <span className="font-bold text-stone-900 text-sm">MockMate Pro</span>
          </div>

          <h2 className="text-xl font-bold text-stone-950 mb-1">Sign in to your account</h2>
          <p className="text-xs text-stone-500 mb-6">Enter your credentials to continue to your dashboard.</p>

          {notice && (
            <div role="status" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
              {notice}
            </div>
          )}

          {/* Demo credentials are only included in development builds. */}
          {import.meta.env.DEV && <div
            onClick={() => setForm({ email: 'testuser@gmail.com', password: 'testpassword@1234' })}
            className="mb-6 rounded-lg border border-stone-200 bg-white p-3.5 shadow-xs cursor-pointer hover:border-brand-500 hover:bg-stone-50/50 transition-all"
            title="Click to auto-fill demo credentials"
          >
            <div className="text-xs font-semibold text-stone-900 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Demo Credentials
              </span>
              <span className="text-[10px] text-brand-700 font-normal hover:underline">Click to fill</span>
            </div>
            <div className="space-y-0.5 text-xs text-stone-600 font-mono">
              <p>email: testuser@gmail.com</p>
              <p>pass: testpassword@1234</p>
            </div>
          </div>}

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Email address</label>
              <input
                className={`input-field ${errors.email ? 'input-error' : ''}`}
                type="email"
                placeholder="name@company.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-stone-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-stone-600 hover:text-stone-950 hover:underline">
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  className={`input-field pr-9 ${errors.password ? 'input-error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPw ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-red-600 mt-1">{errors.password}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !mt-5">
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-stone-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-stone-900 hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
