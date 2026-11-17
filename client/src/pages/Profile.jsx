import { useEffect, useState } from 'react'
import { authAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import Loader from '../components/Loader'
import toast from 'react-hot-toast'

const Profile = () => {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({ name: user?.name || '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let mounted = true

    const loadProfile = async () => {
      try {
        const { data } = await authAPI.getMe()
        if (!mounted) return
        setForm({ name: data?.user?.name || '' })
        setStats(data?.user || null)
      } catch {
        if (!mounted) return
        setStats(user || null)
        setForm({ name: user?.name || '' })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadProfile()
    return () => { mounted = false }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }

    try {
      setSaving(true)
      const { data } = await authAPI.updateMe({ name: form.name.trim() })
      updateUser(data.user)
      setStats(data.user)
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader text="Loading profile..." />

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <div className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">Account Settings</h1>
          <p className="text-xs text-stone-500 mt-0.5">Manage your user profile and view account details.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="card p-6 border-stone-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-brand-700 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                {stats?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900 truncate">{stats?.name || 'User'}</h2>
                <p className="text-xs text-stone-500 truncate">{stats?.email}</p>
                <div className="mt-2">
                  {stats?.isPremium ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 px-2.5 py-0.5 text-xs font-semibold border border-amber-200">
                      Premium Member
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-700 px-2.5 py-0.5 text-xs font-medium border border-stone-200">
                      Standard Tier
                    </span>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">Display name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ name: e.target.value })}
                  className="input-field"
                  placeholder="Your full name"
                />
              </div>

              <button type="submit" disabled={saving} className="btn-primary !w-auto !px-5">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="card p-5 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">Account summary</h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-stone-500">Email</span>
                  <span className="font-medium text-stone-900 text-right break-all">{stats?.email}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-stone-500">Plan</span>
                  {stats?.isPremium ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px] font-semibold border border-amber-200">
                      Premium
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 text-[11px] font-medium border border-stone-200">
                      Standard
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-stone-500">Member since</span>
                  <span className="font-medium text-stone-900">
                    {stats?.createdAt ? new Date(stats.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="card p-5 bg-stone-50/70 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-1.5">Note</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Your name appears on session scorecards and interview review summaries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile