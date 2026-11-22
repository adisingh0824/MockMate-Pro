import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { interviewAPI, sessionAPI } from '../services/api';
import { DEFAULT_ROLES } from '../constants/defaults';
import toast from 'react-hot-toast';

const LEVELS = [
  {
    id: 'fresher',
    label: 'Entry / Graduate',
    desc: '0–1 year experience',
    detail: '5 core questions · Fundamentals and key concepts',
  },
  {
    id: 'junior',
    label: 'Mid-Level',
    desc: '1–3 years experience',
    detail: '8 scenario questions · Architecture and edge-case handling',
  },
  {
    id: 'senior',
    label: 'Senior / Staff',
    desc: '3+ years experience',
    detail: '10 comprehensive questions · System design and trade-offs',
  },
];

const InterviewSetup = () => {
  const navigate = useNavigate();
  const [roles, setRoles]       = useState([]);
  const [role, setRole]         = useState('');
  const [level, setLevel]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    sessionAPI.getRoles()
      .then(r => setRoles(Array.isArray(r.data.roles) && r.data.roles.length > 0 ? r.data.roles : DEFAULT_ROLES))
      .catch(() => setRoles(DEFAULT_ROLES))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    if (!role)  return toast.error('Please select an engineering role');
    if (!level) return toast.error('Please select an experience level');
    setStarting(true);
    try {
      const { data } = await interviewAPI.start({ role, level });
      if (!data?.success) throw new Error(data?.message || 'Failed to start interview simulation');
      navigate(`/live-interview/${data.session.id}`, {
        state: { session: data.session, firstQuestion: data.firstQuestion },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to launch interview simulation');
    } finally {
      setStarting(false);
    }
  };

  const selectedLevel = LEVELS.find(l => l.id === level);

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-6 border-b border-stone-200 pb-5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">Simulation</span>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight mt-1">Live Technical Interview Simulation</h1>
          <p className="text-xs text-stone-500 mt-1">
            Simulates a real conversation: questions adapt based on your verbal or typed answers, followed by a rubric scorecard.
          </p>
        </div>

        {/* Step 1 — Role */}
        <div className="card p-5 mb-4 border-stone-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
            <span className="w-4 h-4 bg-stone-900 text-white rounded flex items-center justify-center text-[10px] font-bold">1</span>
            Target Role
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-10 bg-stone-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {roles.map(r => {
                const label = typeof r === 'string' ? r : r?.name;
                return (
                  <button
                    key={label}
                    onClick={() => setRole(label)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-semibold border text-left capitalize transition-all ${
                      role === label
                        ? 'border-brand-700 bg-brand-700 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Step 2 — Level */}
        <div className="card p-5 mb-4 border-stone-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3 flex items-center gap-2">
            <span className="w-4 h-4 bg-stone-900 text-white rounded flex items-center justify-center text-[10px] font-bold">2</span>
            Seniority & Scope
          </h2>
          <div className="grid grid-cols-1 gap-2.5">
            {LEVELS.map(l => (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  level === l.id
                    ? 'border-brand-700 bg-brand-50/70 text-stone-900 ring-1 ring-brand-700'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-stone-900">
                        {l.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200 font-medium">
                        {l.desc}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 text-stone-500">
                      {l.detail}
                    </p>
                  </div>
                  {level === l.id && (
                    <div className="w-4 h-4 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Guidance Note */}
        <div className="card p-4 mb-5 bg-stone-50/80 border-stone-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-2">Round Format</h3>
          <ul className="space-y-1.5 text-xs text-stone-600">
            <li className="flex items-start gap-2">
              <span className="text-stone-400">•</span>
              <span>Questions are delivered sequentially with real-time audio playback.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-400">•</span>
              <span>Respond verbally via microphone or type your response in the editor.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-stone-400">•</span>
              <span>Receive an analytical evaluation with actionable scoring at completion.</span>
            </li>
          </ul>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!role || !level || starting}
          className="btn-primary w-full !py-3 text-sm"
        >
          {starting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Initializing interview environment...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Start Interview Simulation
              {role && selectedLevel && (
                <span className="opacity-80 font-normal text-xs">
                  ({role} · {selectedLevel.label})
                </span>
              )}
            </span>
          )}
        </button>

      </div>
    </div>
  );
};

export default InterviewSetup;
