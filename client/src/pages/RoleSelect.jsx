import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionAPI } from '../services/api'
import { DEFAULT_ROLES, DEFAULT_CONFIG } from '../constants/defaults'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

const DIFF_STYLES = {
  easy: 'border-emerald-600 bg-emerald-50 text-emerald-900',
  medium: 'border-amber-600 bg-amber-50 text-amber-900',
  hard: 'border-rose-600 bg-rose-50 text-rose-900',
}

const RoleSelect = () => {
  const navigate = useNavigate()
  const [roles, setRoles]     = useState([])
  const [diffs, setDiffs]     = useState([])
  const [counts, setCounts]   = useState([])
  const [role, setRole]       = useState('')
  const [diff, setDiff]       = useState('medium')
  const [count, setCount]     = useState(25)
  const [loading, setLoading] = useState(false)
  const [starting, setStart]  = useState(false)

  const getRoleLabel = (roleOption) =>
    typeof roleOption === 'string' ? roleOption : (roleOption?.name || '')

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([sessionAPI.getRoles(), sessionAPI.getConfig()])
      .then(([rolesRes, configRes]) => {
        const nextRoles = rolesRes.status === 'fulfilled' && rolesRes.value.data?.roles?.length
          ? rolesRes.value.data.roles
          : DEFAULT_ROLES
        const config = configRes.status === 'fulfilled' && configRes.value.data?.config
          ? configRes.value.data.config
          : DEFAULT_CONFIG
        const nextDiffs = Array.isArray(config.difficulties) ? config.difficulties : DEFAULT_CONFIG.difficulties
        const nextCounts = Array.isArray(config.questionCounts) ? config.questionCounts : DEFAULT_CONFIG.questionCounts

        setRoles(nextRoles)
        setDiffs(nextDiffs)
        setCounts(nextCounts)

        if (config.defaultDifficulty) setDiff(config.defaultDifficulty)
        if (config.defaultQuestionCount) setCount(Number(config.defaultQuestionCount))
      })
      .catch(() => {
        setRoles(DEFAULT_ROLES)
        setDiffs(DEFAULT_CONFIG.difficulties)
        setCounts(DEFAULT_CONFIG.questionCounts)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleStart = async () => {
    if (!role) { toast.error('Please select an engineering role'); return }
    setStart(true)
    try {
      const res = await sessionAPI.startSession({
        role,
        difficulty: diff,
        count: count,
        type: 'interview',
      })
      toast.success('Interview session created')
      navigate(`/session/${res.data.session.id}`, {
        state: {
          session: res.data.session,
          selectedCount: count,
        },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize session')
    } finally { setStart(false) }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">
        <div className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Structured Mock Round</h1>
          <p className="text-xs text-stone-500 mt-1">Configure your role track, difficulty level, and question set.</p>
        </div>

        <div className="card mb-4 border-stone-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">1. Select Target Track</h2>
          {loading
            ? <div className="grid grid-cols-2 gap-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-stone-100 rounded-lg animate-pulse" />)}</div>
            : <div className="grid grid-cols-2 gap-2">
                {roles.map((r, idx) => {
                  const label = getRoleLabel(r)
                  const key = typeof r === 'string' ? r : (r?.slug || `${label}-${idx}`)
                  return (
                  <button
                    key={key}
                    onClick={() => setRole(label)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold border text-left capitalize transition-all ${
                      role === label
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    {label}
                  </button>
                )})}
              </div>
          }
        </div>

        <div className="card mb-4 border-stone-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">2. Evaluation Level</h2>
          <div className="grid grid-cols-3 gap-3">
            {diffs.map((d) => (
              <button
                key={d.value}
                onClick={() => setDiff(d.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  diff === d.value
                    ? (DIFF_STYLES[d.value] || 'border-brand-700 bg-brand-50 text-brand-900')
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                <div className="font-bold text-xs">{d.label}</div>
                <div className="text-[11px] opacity-75 mt-0.5">{d.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card mb-6 border-stone-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">3. Question Volume</h2>
          <div className="grid grid-cols-3 gap-3">
            {counts.map((cVal) => (
              <button
                key={cVal}
                onClick={() => setCount(cVal)}
                className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                  count === cVal
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                }`}
              >
                {cVal} questions
              </button>
            ))}
          </div>
        </div>

        {role && (
          <div className="bg-white border border-stone-200 rounded-lg p-3.5 mb-5 shadow-xs">
            <p className="text-xs text-stone-700">
              Selected: <strong className="text-stone-900 capitalize">{role}</strong> ({diff} difficulty) with <strong>{count} questions</strong>.
            </p>
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!role || starting}
          className="btn-primary w-full"
        >
          {starting
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block align-middle mr-2" />Starting session...</>
            : 'Start Interview Session →'
          }
        </button>
      </div>
    </div>
  )
}
export default RoleSelect
