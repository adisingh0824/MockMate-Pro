import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const sendOtp = async () => {
    if (!email) {
      toast.error('Email is required')
      return
    }
    try {
      setLoading(true)
      const res = await authAPI.forgotPassword(email)
      toast.success(res.data?.message || 'Reset code sent to your email')
      if (res.data?.devOtp) setOtp(res.data.devOtp)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send reset code')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (!otp || otp.length < 6) {
      toast.error('Enter the 6-digit OTP')
      return
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    try {
      setLoading(true)
      await authAPI.resetPassword({ email, otp, password })
      toast.success('Password reset successfully. Please sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    try {
      setResending(true)
      const res = await authAPI.forgotPassword(email)
      if (res.data?.devOtp) setOtp(res.data.devOtp)
      toast.success(res.data?.message || 'New reset code sent')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend code')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md card p-7 shadow-xs border-stone-200">
        <h1 className="text-xl font-bold text-stone-900 mb-1">Reset password</h1>
        <p className="text-xs text-stone-500 mb-6">Enter your email to receive a 6-digit verification code.</p>

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <button onClick={sendOtp} disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">Verification code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field"
                placeholder="6-digit code"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min. 6 characters"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Updating...' : 'Update password'}
            </button>
            <button type="button" onClick={resendOtp} disabled={resending} className="w-full text-xs font-semibold text-brand-700 hover:underline">
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-stone-500 mt-6">
          Back to{' '}
          <Link to="/login" className="text-brand-700 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
