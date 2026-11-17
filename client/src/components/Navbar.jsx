import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const links = [
    { to: '/dashboard',       label: 'Dashboard' },
    { to: '/practice-select', label: 'Practice Drills' },
    { to: '/interview-setup', label: 'Live Simulation' },
    { to: '/company-prep',    label: 'Company Tracks' },
    { to: '/history',         label: 'Activity Log' },
  ]

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between sm:px-6 lg:px-8">
        <Link to="/dashboard" className="flex items-center gap-2.5 no-underline group">
          <div className="w-7 h-7 bg-stone-900 rounded-md flex items-center justify-center text-white text-xs font-mono font-bold shadow-xs">
            M
          </div>
          <span className="font-bold text-stone-950 text-sm tracking-tight hidden sm:block">MockMate Pro</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors no-underline ${
                pathname === to
                  ? 'bg-stone-100 text-stone-950 font-semibold'
                  : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="relative flex items-center gap-2" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-stone-100 transition-colors cursor-pointer border border-transparent hover:border-stone-200"
          >
            <div className="w-6 h-6 bg-stone-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-xs text-stone-800 font-medium hidden md:block">{user?.name}</span>
            <svg className={`hidden md:block text-stone-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 w-52 rounded-xl border border-stone-200 bg-white shadow-lg py-1.5 z-50">
              <div className="px-3.5 py-2 border-b border-stone-100">
                <p className="text-xs font-bold text-stone-900 truncate">{user?.name}</p>
                <p className="text-[11px] text-stone-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile') }}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-stone-50 transition-colors cursor-pointer ${pathname === '/profile' ? 'text-stone-950 font-bold bg-stone-50' : 'text-stone-700'}`}
              >
                Account Settings
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate('/history') }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer sm:hidden"
              >
                Activity Log
              </button>
              <button
                onClick={() => { setMenuOpen(false); logout(); navigate('/') }}
                className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-t border-stone-100"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar