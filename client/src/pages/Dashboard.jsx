import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';

const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const scoreBadge = (s) =>
  s >= 7
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : s >= 5
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : 'bg-rose-50 text-rose-800 border-rose-200';

const diffBadge = {
  easy: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  hard: 'bg-rose-50 text-rose-800 border-rose-200',
};

const typeBadge = {
  practice: 'bg-stone-100 text-stone-800 border-stone-200',
  interview: 'bg-brand-50 text-brand-800 border-brand-200',
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActive] = useState('overview');

  useEffect(() => {
    sessionAPI
      .getHistory()
      .then((r) =>
        setHistory(Array.isArray(r.data.sessions) ? r.data.sessions : [])
      )
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const completed = history.filter((s) => s.completedAt);
  const total = completed.length;

  const avgScore = total
    ? (
        completed.reduce((acc, s) => acc + (s.overallScore || 0), 0) / total
      ).toFixed(1)
    : null;

  const bestScore = total
    ? Math.max(...completed.map((s) => s.overallScore || 0))
    : null;

  const uniqueRoles = [...new Set(history.map((s) => s.role))].length;

  const scoreDist = { excellent: 0, good: 0, average: 0, poor: 0 };
  completed.forEach((s) => {
    const pct = (s.overallScore || 0) * 10;
    if (pct >= 80) scoreDist.excellent++;
    else if (pct >= 60) scoreDist.good++;
    else if (pct >= 40) scoreDist.average++;
    else scoreDist.poor++;
  });

  const roleCounts = {};
  history.forEach((s) => {
    roleCounts[s.role] = (roleCounts[s.role] || 0) + 1;
  });
  const topRoles = Object.entries(roleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const diffCounts = { easy: 0, medium: 0, hard: 0 };
  history.forEach((s) => {
    if (diffCounts[s.difficulty] !== undefined) diffCounts[s.difficulty]++;
  });

  const days = [
    ...new Set(completed.map((s) => new Date(s.completedAt).toDateString())),
  ].sort((a, b) => new Date(b) - new Date(a));

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < days.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (days[i] === expected.toDateString()) streak++;
    else break;
  }

  const recentSessions = history.slice(0, 6);

  const kpis = [
    {
      label: 'Sessions Completed',
      value: total,
      sub: total === 1 ? '1 session finished' : `${total} sessions finished`,
    },
    {
      label: 'Average Score',
      value: avgScore ? `${avgScore} / 10` : '—',
      sub: 'Across all rounds',
    },
    {
      label: 'Highest Score',
      value: bestScore !== null ? `${bestScore} / 10` : '—',
      sub: 'Personal best',
    },
    {
      label: 'Roles Practiced',
      value: uniqueRoles,
      sub: 'Tracks explored',
    },
    {
      label: 'Active Streak',
      value: `${streak || 0}d`,
      sub: 'Consecutive days',
    },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        {/* Header Greeting */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">
              {greet()}, {user?.name?.split(' ')[0] || 'there'}
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              {total === 0
                ? 'Ready for your first session? Choose a track below to get started.'
                : `You have completed ${total} practice session${total !== 1 ? 's' : ''}. Keep building consistency.`}
            </p>
          </div>

          {user?.isPremium ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full border border-amber-200 self-start sm:self-auto">
              Premium Account
            </span>
          ) : (
            <button
              onClick={() => navigate('/premium')}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 underline-offset-4 hover:underline self-start sm:self-auto"
            >
              Upgrade to Premium →
            </button>
          )}
        </div>

        {/* Action Callout */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 mb-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Get Started</span>
            <h2 className="text-base font-bold text-stone-900 mt-0.5">
              Launch a new preparation round
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Select your role, difficulty, and practice mode to begin.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => navigate('/practice-select')}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors"
            >
              Practice Drills
            </button>
            <button
              onClick={() => navigate('/interview-setup')}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-brand-700 hover:bg-brand-800 shadow-xs transition-colors"
            >
              Live Interview
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {kpis.map(({ label, value, sub }) => (
            <div key={label} className="card p-4 border-stone-200">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 block">
                {label}
              </span>
              <div className="text-xl font-bold text-stone-900 mt-1">{value}</div>
              <div className="text-[11px] text-stone-400 mt-0.5 leading-tight">
                {sub}
              </div>
            </div>
          ))}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 mb-5">
          {[
            { id: 'overview', label: 'Performance Overview' },
            { id: 'recent', label: `Recent Sessions (${recentSessions.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={
                'py-2.5 px-4 text-xs font-bold transition-all border-b-2 -mb-px ' +
                (activeTab === t.id
                  ? 'border-brand-700 text-brand-700'
                  : 'border-transparent text-stone-500 hover:text-stone-800')
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Score Distribution */}
            <div className="card p-5 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Score Distribution
              </h3>

              {total === 0 ? (
                <p className="text-xs text-stone-400">No session data recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Strong (80–100%)', count: scoreDist.excellent, color: 'bg-emerald-600' },
                    { label: 'Competent (60–79%)', count: scoreDist.good, color: 'bg-teal-600' },
                    { label: 'Developing (40–59%)', count: scoreDist.average, color: 'bg-amber-500' },
                    { label: 'Needs Focus (<40%)', count: scoreDist.poor, color: 'bg-stone-400' },
                  ].map(({ label, count, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-stone-600 mb-1">
                        <span>{label}</span>
                        <span className="font-semibold text-stone-900">{count}</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${color}`}
                          style={{ width: total ? (count / total) * 100 + '%' : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Difficulty Split */}
            <div className="card p-5 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Difficulty Split
              </h3>

              {history.length === 0 ? (
                <p className="text-xs text-stone-400">No session data recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {['easy', 'medium', 'hard'].map((d) => (
                    <div key={d}>
                      <div className="flex justify-between text-xs text-stone-600 mb-1">
                        <span className="capitalize">{d}</span>
                        <span className="font-semibold text-stone-900">{diffCounts[d]} rounds</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={
                            'h-full rounded-full transition-all duration-500 ' +
                            (d === 'easy'
                              ? 'bg-emerald-600'
                              : d === 'medium'
                              ? 'bg-amber-500'
                              : 'bg-stone-700')
                          }
                          style={{
                            width: history.length
                              ? (diffCounts[d] / history.length) * 100 + '%'
                              : '0%',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Roles */}
            <div className="card p-5 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-4">
                Most Practiced Tracks
              </h3>

              {topRoles.length === 0 ? (
                <p className="text-xs text-stone-400">No session data recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {topRoles.map(([role, count]) => (
                    <div key={role} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700 text-xs font-bold flex-shrink-0">
                        {role.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-800 truncate capitalize">
                          {role}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          {count} session{count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="h-1.5 w-16 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-700 rounded-full"
                          style={{
                            width: topRoles[0][1]
                              ? (count / topRoles[0][1]) * 100 + '%'
                              : '0%',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preparation Strategy Checklist */}
            <div className="card p-5 border-stone-200 bg-stone-50/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">
                Milestones
              </h3>
              <ul className="space-y-2.5">
                {[
                  { text: 'Complete at least one interview simulation', done: history.some((s) => s.type === 'interview') },
                  { text: 'Score 80%+ on an evaluation', done: scoreDist.excellent > 0 },
                  { text: 'Attempt Hard difficulty questions', done: diffCounts.hard > 0 },
                  { text: 'Maintain a 3-day practice habit', done: streak >= 3 },
                ].map(({ text, done }) => (
                  <li key={text} className="flex items-start gap-2.5 text-xs text-stone-700">
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded border ${
                        done ? 'bg-brand-700 border-brand-700 text-white' : 'border-stone-300 bg-white text-transparent'
                      }`}
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    </span>
                    <span className={done ? 'text-stone-400 line-through' : ''}>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'recent' && (
          <div>
            {recentSessions.length === 0 ? (
              <div className="card py-14 text-center border-stone-200">
                <p className="text-sm font-semibold text-stone-800">No sessions recorded yet</p>
                <p className="text-xs text-stone-500 mt-1 mb-4">
                  Complete your first practice round to see reports and history here.
                </p>
                <button
                  onClick={() => navigate('/practice-select')}
                  className="btn-primary inline-flex !w-auto !px-4"
                >
                  Start First Session
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentSessions.map((s) => (
                  <div
                    key={s._id}
                    onClick={() => navigate('/feedback/' + s._id)}
                    className="card p-3.5 cursor-pointer hover:border-stone-400 transition-all flex items-center gap-3.5 border-stone-200"
                  >
                    <div
                      className={`w-11 h-11 rounded-lg border flex flex-col items-center justify-center font-bold flex-shrink-0 ${scoreBadge(s.overallScore || 0)}`}
                    >
                      <span className="text-sm leading-none font-bold">
                        {s.overallScore || 0}
                      </span>
                      <span className="text-[10px] opacity-75 font-normal">/10</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 text-xs capitalize truncate">
                        {s.role}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${diffBadge[s.difficulty] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                          {s.difficulty}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${typeBadge[s.type] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                          {s.type || 'practice'}
                        </span>
                        <span className="text-[11px] text-stone-400 ml-1">
                          {fmtDate(s.completedAt || s.createdAt)}
                        </span>
                      </div>
                    </div>

                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-stone-400 flex-shrink-0">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}

                {history.length > 6 && (
                  <button
                    onClick={() => navigate('/history')}
                    className="w-full py-2.5 text-xs font-semibold text-brand-700 hover:text-brand-800 text-center transition-colors"
                  >
                    View all {history.length} sessions →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
