import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
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

const Register = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm]     = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)

  const validate = () => {
    const e = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'
    if (!form.email || !/^[\w.-]+@[\w.-]+\.\w{2,}$/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    try {
      // 1. Try standard registration via backend
      const res = await authAPI.register({
        name: form.name.trim(),
        email: form.email.toLowerCase(),
        password: form.password,
      })

      // If simulated / dev OTP was returned (e.g. Resend sandbox), auto-verify directly so user lands in dashboard
      if (res.data?.devOtp) {
        try {
          const verifyRes = await authAPI.verifyOtp({
            email: form.email.toLowerCase(),
            otp: res.data.devOtp,
          })
          if (verifyRes.data?.token && verifyRes.data?.user) {
            login(verifyRes.data.token, verifyRes.data.user)
            toast.success(`Account created! Welcome, ${verifyRes.data.user.name}`)
            navigate('/dashboard', { replace: true })
            return
          }
        } catch (autoVerifyErr) {
          console.warn('Auto-verification skipped, navigating to verification screen:', autoVerifyErr.message)
        }
      }

      toast.success(res.data?.message || 'Verification code dispatched')
      navigate('/verify-otp', {
        state: {
          email: form.email.toLowerCase(),
          devOtp: res.data?.devOtp,
        },
      })
    } catch (err) {
      if (err.response?.status === 503) {
        toast.error(err.response?.data?.message || 'Email delivery is unavailable. Please try again later.')
        return
      }

      if (err.response) {
        toast.error(err.response.data?.message || 'Registration failed. Please try again.')
        return
      }

      // If the backend cannot be reached, Firebase can still establish the identity.
      console.warn('Backend register failed, activating Firebase Auth fallback:', err.message)

      try {
        const userCred = await createUserWithEmailAndPassword(
          firebaseAuth,
          form.email.toLowerCase(),
          form.password
        )

        if (form.name.trim()) {
          try {
            await updateProfile(userCred.user, { displayName: form.name.trim() })
          } catch (profileErr) {
            console.warn('Profile update optional step skipped:', profileErr.message)
          }
        }

        if (!userCred.user.emailVerified) {
          await sendEmailVerification(userCred.user)
          await signOut(firebaseAuth)
          toast.success('Check your email to verify your address, then sign in to continue.')
          navigate('/login')
          return
        }

        const idToken = await userCred.user.getIdToken()
        let activeToken = idToken
        let userData = {
          id: userCred.user.uid,
          name: form.name.trim() || userCred.user.displayName || 'Candidate',
          email: form.email.toLowerCase(),
          isPremium: false,
        }

        // Synchronize with backend to acquire native MockMate JWT
        try {
          const syncRes = await authAPI.firebaseSync({
            email: form.email.toLowerCase(),
            name: userData.name,
            idToken,
          })
          if (syncRes.data?.token) {
            activeToken = syncRes.data.token
            if (syncRes.data?.user) userData = syncRes.data.user
          }
        } catch (syncErr) {
          console.warn('Backend sync deferred, continuing with Firebase credentials:', syncErr.message)
        }

        login(activeToken, userData)
        toast.success(`Account created successfully! Welcome, ${userData.name}`)
        navigate('/dashboard', { replace: true })
      } catch (fbErr) {
        if (fbErr.code === 'auth/email-already-in-use') {
          // If the account already exists in Firebase, sign in directly with entered credentials
          try {
            const loginCred = await signInWithEmailAndPassword(
              firebaseAuth,
              form.email.toLowerCase(),
              form.password
            )
            if (!loginCred.user.emailVerified) {
              await sendEmailVerification(loginCred.user)
              await signOut(firebaseAuth)
              toast.success('Check your email to verify your address, then sign in to continue.')
              navigate('/login')
              return
            }
            const idToken = await loginCred.user.getIdToken()
            let activeToken = idToken
            let userData = {
              id: loginCred.user.uid,
              name: form.name.trim() || loginCred.user.displayName || 'Candidate',
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
                activeToken = syncRes.data.token
                if (syncRes.data?.user) userData = syncRes.data.user
              }
            } catch (syncErr) {
              console.warn('Sync notice:', syncErr.message)
            }

            login(activeToken, userData)
            toast.success(`Welcome back, ${userData.name}!`)
            navigate('/dashboard', { replace: true })
            return
          } catch (signInErr) {
            console.warn('Sign-in fallback failed:', signInErr.message)
            toast.error('This email is already registered. Please sign in.')
            navigate('/login')
          }
        } else {
          const msg = err.response?.data?.message || fbErr.message || 'Registration failed'
          toast.error(msg)
        }
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
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider block mb-2">Account Setup</span>
            <h1 className="text-3xl font-bold tracking-tight text-white leading-tight mb-4">
              Prepare with real engineering evaluation criteria.
            </h1>
            <p className="text-stone-400 text-xs sm:text-sm leading-relaxed mb-10">
              Create an account to configure custom role tracks, record live interview rounds, and monitor performance progress over time.
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
      <div className="flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-stone-900 text-white rounded flex items-center justify-center font-mono text-xs font-bold">
              M
            </div>
            <span className="font-bold text-stone-900 text-sm">MockMate Pro</span>
          </div>

          <h2 className="text-xl font-bold text-stone-950 mb-1">Create an account</h2>
          <p className="text-xs text-stone-500 mb-6">Enter your details to configure your candidate profile.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Full name</label>
              <input
                className={`input-field ${errors.name ? 'input-error' : ''}`}
                type="text"
                placeholder="Aditya Singh"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
              {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
            </div>

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
              <label className="block text-xs font-medium text-stone-700 mb-1">Password</label>
              <div className="relative">
                <input
                  className={`input-field pr-9 ${errors.password ? 'input-error' : ''}`}
                  type={showPw ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
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

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Confirm password</label>
              <input
                className={`input-field ${errors.confirm ? 'input-error' : ''}`}
                type="password"
                placeholder="Re-enter password"
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
              />
              {errors.confirm && <p className="text-[11px] text-red-600 mt-1">{errors.confirm}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !mt-5">
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Creating Profile...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-xs text-stone-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-stone-900 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
