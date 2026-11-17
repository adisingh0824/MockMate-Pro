import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionAPI } from '../services/api';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';

const FeedBack = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    sessionAPI
      .getSession(id)
      .then((res) => {
        setSession(res.data.session);
        setLoading(false);
      })
      .catch(() => {
        setError('Session not found or access unauthorized.');
        setLoading(false);
      });
  }, [id]);

  if (loading) return <Loader text="Compiling evaluation scorecard..." />;

  if (error || !session) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <p className="text-sm font-semibold text-stone-800 mb-2">{error || 'Session not found'}</p>
          <button onClick={() => navigate('/history')} className="btn-primary !w-auto !px-4">
            Return to History
          </button>
        </div>
      </div>
    );
  }

  const result = session;
  const score = result.overallScore ?? 0;
  const questions = Array.isArray(result.questions) ? result.questions : [];
  const total = questions.length;
  const correct = questions.filter((q) => q.isCorrect).length;
  const incorrect = total - correct;
  const unanswered = questions.filter((q) => !q.userAnswer).length;
  const percentage = total ? Math.round((correct / total) * 100) : 0;

  const getGrade = (pct) => {
    if (pct >= 90) return { grade: 'A+', label: 'Exemplary' };
    if (pct >= 75) return { grade: 'A',  label: 'Proficient' };
    if (pct >= 60) return { grade: 'B',  label: 'Competent' };
    if (pct >= 40) return { grade: 'C',  label: 'Developing' };
    return           { grade: 'D',  label: 'Needs Focus' };
  };

  const { grade, label } = getGrade(percentage);

  const scoreStyle =
    percentage >= 75
      ? { ring: 'border-emerald-300', bg: 'bg-emerald-50/50', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-800' }
      : percentage >= 50
      ? { ring: 'border-amber-300', bg: 'bg-amber-50/50', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-800' }
      : { ring: 'border-rose-300', bg: 'bg-rose-50/50', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-800' };

  const getQuestionText = (q) => q?.questionText || q?.question || 'Question';
  const getDisplayAnswer = (q) => {
    if (!q.userAnswer) return null;
    if (!Array.isArray(q.options)) return q.userAnswer;
    const matched = q.options.find((o) => o.startsWith(q.userAnswer + '.'));
    return matched || q.userAnswer;
  };

  const diffBadge = {
    easy:   'bg-emerald-50 text-emerald-800 border-emerald-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    hard:   'bg-rose-50 text-rose-800 border-rose-200',
  };

  const completedDate = result.completedAt
    ? new Date(result.completedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-6 border-b border-stone-200 pb-5">
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors mb-3 font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Activity Log
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-stone-900 tracking-tight">Assessment Evaluation</h1>
            <span className={`text-[10px] px-2 py-0.5 rounded border capitalize font-medium ${diffBadge[result.difficulty] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
              {result.difficulty}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded border capitalize font-medium bg-brand-50 text-brand-800 border-brand-200">
              {result.type || 'practice'}
            </span>
            {result.company && (
              <span className="text-[10px] px-2 py-0.5 rounded border capitalize font-medium bg-stone-100 text-stone-800 border-stone-200">
                {result.company}
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-1 capitalize">{result.role}</p>
          {completedDate && (
            <p className="text-[11px] text-stone-400 mt-0.5">Assessed on {completedDate}</p>
          )}
        </div>

        {/* Score Card */}
        <div className={`card border ${scoreStyle.ring} ${scoreStyle.bg} mb-6 text-center py-7`}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Overall Assessment</div>
          <div className={`text-5xl font-black ${scoreStyle.text} mb-1 tracking-tight`}>{percentage}%</div>
          <div className={`inline-block text-xs font-bold px-3 py-0.5 rounded-full ${scoreStyle.badge} mb-2`}>
            Tier {grade} · {label}
          </div>
          <p className="text-stone-600 text-xs">
            {correct} correct out of {total} questions · Raw score {score} / 10
          </p>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-3.5 text-center border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Correct</span>
            <span className="text-xl font-black text-emerald-700 mt-0.5 block">{correct}</span>
            <span className="text-[10px] text-stone-500">answers</span>
          </div>
          <div className="card p-3.5 text-center border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Incorrect</span>
            <span className="text-xl font-black text-rose-700 mt-0.5 block">{incorrect}</span>
            <span className="text-[10px] text-stone-500">answers</span>
          </div>
          <div className="card p-3.5 text-center border-stone-200">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Unanswered</span>
            <span className="text-xl font-black text-stone-700 mt-0.5 block">{unanswered}</span>
            <span className="text-[10px] text-stone-500">skipped</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 mb-5">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-2.5 px-4 font-bold text-xs border-b-2 -mb-px transition-colors ${
              activeTab === 'summary'
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Summary & Analytics
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-2.5 px-4 font-bold text-xs border-b-2 -mb-px transition-colors ${
              activeTab === 'questions'
                ? 'border-brand-700 text-brand-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Item Review ({questions.length})
          </button>
        </div>

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="card p-5 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">Session Metadata</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'Role',       value: result.role },
                  { label: 'Difficulty', value: result.difficulty },
                  { label: 'Type',       value: result.type || 'practice' },
                  { label: 'Questions',  value: total },
                  ...(result.company ? [{ label: 'Company', value: result.company }] : []),
                  ...(result.durationMinutes ? [{ label: 'Duration', value: `${result.durationMinutes} min` }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className="text-stone-400 text-[10px] uppercase tracking-wide block">{label}</span>
                    <span className="font-semibold text-stone-800 capitalize">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5 bg-stone-50/70 border-stone-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-1.5">Diagnostic Recommendation</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {percentage >= 75
                  ? 'Strong foundational mastery. Inspect any missed items to identify nuance gaps and increase precision in higher-difficulty tracks.'
                  : 'Review the detailed breakdowns under Item Review. Focus on questions marked incorrect to reinforce underlying concepts before the next session.'}
              </p>
            </div>
          </div>
        )}

        {/* QUESTIONS TAB */}
        {activeTab === 'questions' && (
          <div className="space-y-2.5">
            {questions.map((q, i) => {
              const isOpen = open === i;
              const display = getDisplayAnswer(q);
              const correctOption = Array.isArray(q.options)
                ? q.options.find((o) => o.startsWith(q.correctAnswer + '.'))
                : q.correctAnswer;

              return (
                <div
                  key={i}
                  className={`card overflow-hidden p-0 border transition-all ${
                    q.isCorrect
                      ? 'border-emerald-200'
                      : q.userAnswer
                      ? 'border-rose-200'
                      : 'border-stone-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full p-3.5 text-left flex items-start justify-between gap-3 cursor-pointer hover:bg-stone-50/60"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border ${
                          q.isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : q.userAnswer
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-stone-100 border-stone-200 text-stone-500'
                        }`}
                      >
                        {q.isCorrect ? '✓' : q.userAnswer ? '✗' : '—'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-stone-400 font-bold mb-0.5">Question {i + 1}</p>
                        <p className="text-xs font-medium text-stone-800 leading-snug line-clamp-2">
                          {getQuestionText(q)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          q.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {q.isCorrect ? '+10' : '0'}
                      </span>
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
                        className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-2 border-t border-stone-100 space-y-3 bg-stone-50/30">
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1">
                          Full Prompt
                        </p>
                        <p className="text-xs text-stone-800 leading-relaxed">{getQuestionText(q)}</p>
                      </div>

                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1.5">
                            Options
                          </p>
                          <div className="space-y-1">
                            {q.options.map((opt, oi) => {
                              const letter = String.fromCharCode(65 + oi);
                              const isCorrectOpt = letter === q.correctAnswer;
                              const isUserOpt = letter === q.userAnswer;
                              return (
                                <div
                                  key={oi}
                                  className={`px-3 py-1.5 rounded text-xs border ${
                                    isCorrectOpt
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                      : isUserOpt && !isCorrectOpt
                                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                                      : 'bg-white border-stone-200 text-stone-600'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    {opt}
                                    {isCorrectOpt && (
                                      <span className="ml-auto text-[10px] text-emerald-700 font-bold">✓ Correct Answer</span>
                                    )}
                                    {isUserOpt && !isCorrectOpt && (
                                      <span className="ml-auto text-[10px] text-rose-700 font-bold">✗ Selected</span>
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!Array.isArray(q.options) && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-0.5">
                              Submitted Answer
                            </p>
                            <p className={`text-xs font-medium ${q.isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                              {display || <span className="italic text-stone-400">None provided</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-0.5">
                              Expected Answer
                            </p>
                            <p className="text-xs font-medium text-emerald-800">
                              {correctOption || q.correctAnswer}
                            </p>
                          </div>
                        </div>
                      )}

                      {(q.explanation || q.feedback) && (
                        <div className="bg-white border border-stone-200 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide mb-1">
                            Explanation & Rationale
                          </p>
                          <p className="text-xs text-stone-700 leading-relaxed">
                            {q.explanation || q.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 mt-8">
          <button
            type="button"
            onClick={() => navigate('/practice-select')}
            className="btn-primary flex-1 text-xs"
          >
            Start Another Drill
          </button>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="btn-secondary flex-1 text-xs"
          >
            Return to Log
          </button>
        </div>

      </div>
    </div>
  );
};

export default FeedBack;
