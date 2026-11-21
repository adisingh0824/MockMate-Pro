import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { companyAPI, sessionAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const levelColor = {
  Entry:  'bg-emerald-50 text-emerald-800 border border-emerald-200',
  Mid:    'bg-amber-50 text-amber-800 border border-amber-200',
  Senior: 'bg-stone-100 text-stone-800 border border-stone-200',
}

const CompanyPrep = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [startingRole, setStartingRole] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let mounted = true

    const loadCompanies = async () => {
      try {
        setLoading(true)
        setError('')
        const { data } = await companyAPI.getCompanies()
        if (!mounted) return
        setCompanies(Array.isArray(data?.companies) ? data.companies : [])
      } catch (err) {
        if (!mounted) return
        setError(err.response?.data?.message || 'Failed to load company modules. Please retry.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadCompanies()

    return () => {
      mounted = false
    }
  }, [])

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSchedule = async (company, role) => {
    if (!user?.isPremium) {
      navigate('/premium', {
        state: {
          company: company.name,
          role: role.title,
          level: role.level,
        },
      })
      return
    }

    const diffMap = {
      Entry: 'easy',
      Mid: 'medium',
      Senior: 'hard',
    }
    const diff = diffMap[role.level] || 'medium'
    const targetKey = `${company.name}-${role.title}`
    setStartingRole(targetKey)

    try {
      const res = await sessionAPI.startSession({
        role: role.title,
        company: company.name,
        difficulty: diff,
        count: role.questions || 8,
        durationMinutes: (role.questions || 8) * 2,
        type: 'practice',
      })
      toast.success(`Starting ${company.name} drill for ${role.title}`)
      navigate(`/session/${res.data.session.id}`, {
        state: { session: res.data.session, selectedCount: role.questions || 8 },
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start company practice session')
    } finally {
      setStartingRole('')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Company-Targeted Preparation</h1>
          <p className="text-xs text-stone-500 mt-1">
            Practice questions tailored to specific engineering teams, technical stacks, and hiring rubrics.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search by company name (e.g. Google, Amazon, Meta)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:border-brand-700 transition"
          />
        </div>

        {/* Premium Banner */}
        <div className="border border-stone-200 bg-white rounded-xl p-5 mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Company Tracks</span>
              {user?.isPremium && (
                <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.2 text-[10px] font-semibold">
                  Premium Active
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600">
              {user?.isPremium
                ? 'Your premium access is unlocked. Select any company track below to launch an instant tailored drill.'
                : 'Company-tailored interview simulations and specific rubric evaluations are part of premium access.'}
            </p>
          </div>
          {!user?.isPremium && (
            <button
              onClick={() => navigate('/premium')}
              className="btn-primary !w-auto !px-4 !py-2 text-xs flex-shrink-0"
            >
              View Plans →
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Cards Grid */}
        {loading ? (
          <div className="text-center py-16 text-stone-400 text-xs">Loading company tracks...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-stone-400 text-xs">No matching companies found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(company => (
              <div
                key={company.id}
                className="card bg-white rounded-xl border border-stone-200 overflow-hidden hover:border-stone-400 transition-all p-0"
              >
                {/* Company Header */}
                <div className="px-5 pt-5 pb-4 border-b border-stone-100 bg-stone-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-lg shadow-xs border border-stone-200">
                      {company.logo}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-stone-900">{company.name}</h2>
                      <p className="text-[11px] text-stone-500">{company.roles.length} roles available</p>
                    </div>
                  </div>
                </div>

                {/* Roles */}
                <div className="divide-y divide-stone-100">
                  {(expanded === company.id ? company.roles : company.roles.slice(0, 2)).map((role, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-800 truncate">{role.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${levelColor[role.level] || 'bg-stone-100 text-stone-600'}`}>
                            {role.level}
                          </span>
                          <span className="text-[10px] text-stone-400">{role.questions} questions</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSchedule(company, role)}
                        disabled={Boolean(startingRole)}
                        className="flex-shrink-0 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-50 border border-brand-200 px-3 py-1 rounded transition-colors whitespace-nowrap"
                      >
                        {startingRole === `${company.name}-${role.title}` ? 'Starting...' : 'Start →'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Show more / less */}
                {company.roles.length > 2 && (
                  <button
                    onClick={() => setExpanded(expanded === company.id ? null : company.id)}
                    className="w-full text-[11px] text-stone-500 hover:text-stone-800 font-semibold py-2 border-t border-stone-100 bg-stone-50/50 hover:bg-stone-100 transition-colors"
                  >
                    {expanded === company.id
                      ? 'Show less'
                      : `View ${company.roles.length - 2} more role${company.roles.length - 2 > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CompanyPrep
