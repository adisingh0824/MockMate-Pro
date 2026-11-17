import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'
import { planAPI, paymentAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

const Premium = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { updateUser } = useAuth()
  const { company, role } = location.state || {}
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingPlanId, setProcessingPlanId] = useState('')

  useEffect(() => {
    let mounted = true

    const loadPlans = async () => {
      try {
        setLoading(true)
        setError('')
        const { data } = await planAPI.getPlans()
        if (!mounted) return
        setPlans(Array.isArray(data?.plans) ? data.plans : [])
      } catch (err) {
        if (!mounted) return
        setError(err.response?.data?.message || 'Failed to load subscription plans. Please retry.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadPlans()

    return () => {
      mounted = false
    }
  }, [])

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  const handleUpgrade = async (plan) => {
    const key = import.meta.env.VITE_RAZORPAY_KEY_ID
    if (!key) {
      toast.error('Razorpay key is not configured.')
      return
    }

    try {
      setProcessingPlanId(plan.planId)

      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        throw new Error('Failed to load checkout gateway')
      }

      const { data } = await paymentAPI.createOrder({ planId: plan.planId })
      const order = data?.order
      const transactionId = data?.transactionId

      if (!order?.id) {
        throw new Error('Order creation failed')
      }

      const options = {
        key: data.keyId || key,
        amount: order.amount,
        currency: order.currency,
        name: 'MockMate Pro',
        description: `${plan.name} Plan`,
        order_id: order.id,
        prefill: {
          name: JSON.parse(localStorage.getItem('mm_user') || '{}')?.name || '',
          email: JSON.parse(localStorage.getItem('mm_user') || '{}')?.email || '',
        },
        theme: {
          color: '#18181b',
        },
        handler: async (response) => {
          try {
            if (!response?.razorpay_order_id || !response?.razorpay_payment_id || !response?.razorpay_signature) {
              toast.error('Payment response missing verification fields.')
              return
            }

            const verifyRes = await paymentAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.planId,
            })

            if (verifyRes?.data?.success) {
              if (verifyRes.data?.user) {
                updateUser(verifyRes.data.user)
              }
              toast.success(`${plan.name} upgraded successfully!`)
              setTimeout(() => {
                navigate('/history', { state: { tab: 'transactions' } })
              }, 1200)
            } else {
              toast.error('Payment verification failed. Please check your history.')
            }
          } catch (verifyErr) {
            toast.error(verifyErr?.response?.data?.message || 'Payment verification failed.')
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              if (transactionId) {
                await paymentAPI.cancelTransaction(transactionId)
              }
              toast('Payment flow closed')
            } catch {
              toast('Payment flow closed')
            }
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.on('payment.failed', (response) => {
        toast.error(response?.error?.description || 'Payment did not complete.')
      })
      razorpay.open()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Payment initiation failed')
    } finally {
      setProcessingPlanId('')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 mb-6 transition-colors font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </button>

        {/* Context banner */}
        {company && role && (
          <div className="bg-white border border-stone-200 rounded-xl px-5 py-4 mb-8 flex items-start gap-3 shadow-xs">
            <div className="text-brand-700 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4m0 4h.01"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-900">
                Target track: <span className="text-brand-700">{role}</span> at <span className="text-brand-700">{company}</span>
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                Select a plan below to unlock this target company's simulation track.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Plans & Access</span>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight mt-1 mb-2">Upgrade Your Preparation Access</h1>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Unlimited live mock simulations, full rubric evaluations, and target company question tracks.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {loading ? (
            <div className="md:col-span-3 text-center py-10 text-xs text-stone-400">Loading plan tiers...</div>
          ) : plans.length === 0 ? (
            <div className="md:col-span-3 text-center py-10 text-xs text-stone-400">No active plans configured.</div>
          ) : plans.map(plan => (
            <div
              key={plan.planId}
              className={`relative bg-white rounded-xl border p-6 flex flex-col transition-all ${
                plan.highlight
                  ? 'border-brand-700 shadow-md ring-1 ring-brand-700'
                  : 'border-stone-200 hover:border-stone-400'
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                  plan.highlight
                    ? 'bg-brand-700 text-white'
                    : 'bg-stone-100 text-stone-800 border border-stone-200'
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-sm font-bold text-stone-900 mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-stone-900">{plan.price}</span>
                  <span className="text-xs text-stone-400 font-normal">/ {plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-stone-700">
                    <svg className="flex-shrink-0 text-brand-700 mt-0.5" width="13" height="13"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan)}
                disabled={processingPlanId === plan.planId}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  plan.highlight
                    ? 'bg-brand-700 text-white hover:bg-brand-800'
                    : 'bg-stone-100 text-stone-800 hover:bg-stone-200 border border-stone-200'
                }`}
              >
                {processingPlanId === plan.planId ? 'Processing...' : plan.cta || 'Select Plan'}
              </button>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-stone-500 pt-4 border-t border-stone-200">
          <span>Encrypted Razorpay Checkout</span>
          <span>•</span>
          <span>Immediate Access</span>
          <span>•</span>
          <span>Cancel Anytime</span>
        </div>
      </div>
    </div>
  )
}

export default Premium
