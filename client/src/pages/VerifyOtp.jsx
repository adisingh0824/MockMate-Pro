import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const VerifyOtp = () => {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { login } = useAuth()
  const email  = state?.email || ''
  const devOtp = state?.devOtp || ''
  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [timer, setTimer]     = useState(600)
  const [loading, setLoading] = useState(false)
  const [resending, setRe]    = useState(false)
  const inputs = useRef([])

  useEffect(() => {
    if (!email) { navigate('/register'); return }
    if (devOtp && devOtp.length === 6) {
      setOtp(devOtp.split(''))
    } else {
      inputs.current[0]?.focus()
    }
    const id = setInterval(() => setTimer(t => t > 0 ? t - 1 : 0), 1000)
    return () => clearInterval(id)
  }, [devOtp, email, navigate])

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleChange = (val, idx) => {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]; next[idx] = val; setOtp(next)
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
  }

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputs.current[idx - 1]?.focus()
  }

  const handlePaste = (e) => {
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (d.length === 6) { setOtp(d.split('')); inputs.current[5]?.focus() }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { toast.error('Please enter all 6 digits'); return }
    setLoading(true)
    try {
      const res = await authAPI.verifyOtp({ email, otp: code })
      if (res.data?.token && res.data?.user) {
        // Auto-login: store token and user, then go straight to dashboard
        login(res.data.token, res.data.user)
        toast.success(`Welcome, ${res.data.user.name}! Account created successfully.`)
        navigate('/dashboard', { replace: true })
      } else {
        // Fallback: server didn't return a token (backward compat)
        toast.success('Email verified! Please sign in to continue.')
        navigate('/login', { replace: true })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid verification code')
      setOtp(['', '', '', '', '', ''])
      inputs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    setRe(true)
    try {
      const res = await authAPI.resendOtp(email)
      setTimer(600)
      if (res.data?.devOtp) {
        setOtp(res.data.devOtp.split(''))
        toast.success(`New code: ${res.data.devOtp}`)
      } else {
        setOtp(['', '', '', '', '', ''])
        toast.success('A new code has been sent to your email.')
        inputs.current[0]?.focus()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend code')
    } finally { setRe(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        <div className="card text-center shadow-xs border-stone-200">
          <div className="w-12 h-12 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-center mx-auto mb-5 text-brand-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M22 7l-10 7L2 7"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-1">Check your email</h2>
          <p className="text-xs text-stone-500 mb-1">We sent a 6-digit confirmation code to</p>
          <p className="text-xs font-semibold text-stone-900 mb-4 truncate">{email}</p>

          {/* Dev-mode banner: shown only when OTP was auto-filled */}
          {devOtp && devOtp.length === 6 && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>Dev mode — OTP auto-filled: <strong>{devOtp}</strong></span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-3" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => inputs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(e.target.value, i)}
                  onKeyDown={e => handleKeyDown(e, i)}
                  className={`w-10 h-12 text-center text-lg font-bold rounded-lg border bg-white focus:outline-none transition-all ${
                    digit ? 'border-brand-700 bg-brand-50/50 text-brand-900' : 'border-stone-300 focus:border-brand-700'
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs font-medium mb-5 ${timer > 0 ? 'text-stone-500' : 'text-red-600'}`}>
              {timer > 0 ? `Code expires in ${fmt(timer)}` : 'Code expired — please request a new one'}
            </p>
            <button type="submit" disabled={loading || otp.join('').length < 6} className="btn-primary mb-3">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <button
            onClick={handleResend}
            disabled={resending || timer > 540}
            className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resending ? 'Sending...' : "Didn't receive it? Resend"}
          </button>
        </div>

        <p className="text-center text-xs text-stone-500 mt-5">
          Wrong email? <Link to="/register" className="text-brand-700 font-semibold hover:underline">Go back</Link>
        </p>
      </div>
    </div>
  )
}

export default VerifyOtp
