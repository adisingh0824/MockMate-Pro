import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { sessionAPI, paymentAPI } from '../services/api'
import Navbar from '../components/Navbar'
import Loader from '../components/Loader'

const History = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [sessions, setSessions] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter]     = useState('all')
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'sessions')

  const fetchTransactions = async () => {
    try {
      const transactionsRes = await paymentAPI.getTransactionHistory()
      setTransactions(transactionsRes.data.transactions || [])
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const handleRefreshTransactions = async () => {
    setRefreshing(true)
    await fetchTransactions()
    setRefreshing(false)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsResult, transactionsResult] = await Promise.allSettled([
          sessionAPI.getHistory(),
          paymentAPI.getTransactionHistory(),
        ])
        if (sessionsResult.status === 'fulfilled') {
          setSessions(sessionsResult.value.data?.sessions || [])
        }
        if (transactionsResult.status === 'fulfilled') {
          setTransactions(transactionsResult.value.data?.transactions || [])
        }
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <Loader />

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.difficulty === filter)
  const dc = {
    easy: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    hard: 'bg-rose-50 text-rose-800 border-rose-200',
  }
  const tc = {
    practice: 'bg-stone-100 text-stone-800 border-stone-200',
    interview: 'bg-brand-50 text-brand-800 border-brand-200',
  }
  const getSessionType = (session) => (session?.type === 'practice' ? 'practice' : 'interview')

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'failed': return 'bg-rose-50 text-rose-800 border-rose-200'
      case 'pending': return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'cancelled': return 'bg-stone-100 text-stone-600 border-stone-200'
      default: return 'bg-stone-100 text-stone-600 border-stone-200'
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">Activity Log</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {activeTab === 'sessions' 
                ? `${sessions.length} recorded interview rounds` 
                : `${transactions.length} payment records`}
            </p>
          </div>
          {activeTab === 'sessions' && (
            <button
              onClick={() => navigate('/practice-select')}
              className="btn-primary !w-auto !px-4 !py-2 text-xs"
            >
              + New Session
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 mb-5">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-2.5 px-4 font-bold text-xs border-b-2 -mb-px transition-colors ${
              activeTab === 'sessions'
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Sessions ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`py-2.5 px-4 font-bold text-xs border-b-2 -mb-px transition-colors ${
              activeTab === 'transactions'
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Billing ({transactions.length})
          </button>
        </div>

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <>
            <div className="flex gap-1.5 mb-5">
              {['all', 'easy', 'medium', 'hard'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-xs font-semibold capitalize border transition-all ${
                    filter === f
                      ? 'bg-brand-700 text-white border-brand-700'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="card py-14 text-center border-stone-200">
                <p className="text-sm font-semibold text-stone-800">No session records found</p>
                <p className="text-xs text-stone-500 mt-1">Start a practice test or interview to populate this list.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filtered.map(s => (
                  <div
                    key={s._id}
                    onClick={() => navigate(`/feedback/${s._id}`)}
                    className="card p-3.5 cursor-pointer hover:border-stone-400 transition-all flex items-center gap-3.5 border-stone-200"
                  >
                    <div className={`w-11 h-11 rounded-lg border flex flex-col items-center justify-center font-bold flex-shrink-0 ${
                      s.overallScore >= 7 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : s.overallScore >= 5 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                      <span className="text-sm leading-none font-bold">{s.overallScore || 0}</span>
                      <span className="text-[10px] opacity-75">/10</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 text-xs capitalize truncate">{s.role}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${dc[s.difficulty] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>{s.difficulty}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${tc[getSessionType(s)]}`}>{getSessionType(s)}</span>
                        <span className="text-[11px] text-stone-400 ml-1">
                          {formatDate(s.completedAt || s.createdAt)} · {formatTime(s.completedAt || s.createdAt)}
                        </span>
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleRefreshTransactions}
                disabled={refreshing}
                className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={refreshing ? 'animate-spin' : ''}>
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M3 8h8v8"/>
                </svg>
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {transactions.length === 0 ? (
              <div className="card py-14 text-center border-stone-200">
                <p className="text-sm font-semibold text-stone-800">No payment history recorded</p>
                <p className="text-xs text-stone-500 mt-1">Transactions will appear here when upgrades are made.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map(t => (
                  <div
                    key={t._id}
                    className="card p-4 border-stone-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-xs text-stone-900">{t.planName}</h3>
                          <span className={`text-[10px] capitalize font-semibold px-2 py-0.5 rounded border ${getStatusColor(t.status)}`}>
                            {t.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-stone-600 mt-2">
                          <div>
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Reference</p>
                            <p className="font-mono text-xs text-stone-800">{t.razorpayPaymentId || 'Pending'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Amount</p>
                            <p className="font-semibold text-stone-900">{t.planPrice}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Term</p>
                            <p className="text-stone-800">{t.planPeriod}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-0.5">Date</p>
                            <p className="text-stone-700">{formatDate(t.createdAt)} {formatTime(t.createdAt)}</p>
                          </div>
                        </div>
                        {t.errorMessage && (
                          <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                            Error: {t.errorMessage}
                          </div>
                        )}
                        <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
                          <p className="text-[11px] text-stone-400">Order: <span className="font-mono text-stone-600">{t.razorpayOrderId}</span></p>
                          {t.status === 'pending' && (
                            <button
                              onClick={async () => {
                                try {
                                  await paymentAPI.cancelTransaction(t._id)
                                  await handleRefreshTransactions()
                                } catch (err) {
                                  console.error('Error cancelling transaction:', err)
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                          {t.status === 'failed' && (
                            <button
                              onClick={() => navigate('/premium')}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800 rounded transition-colors"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
export default History