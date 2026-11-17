import { Link } from 'react-router-dom'

const tracks = [
  {
    role: 'Frontend Engineering',
    level: 'Mid to Senior',
    topics: 'React reconciliation, state synchronization, browser rendering, web performance',
    questions: '120+ questions',
  },
  {
    role: 'Backend Engineering',
    level: 'Mid to Staff',
    topics: 'Distributed transactions, caching topologies, API idempotency, database indexing',
    questions: '140+ questions',
  },
  {
    role: 'Full Stack Systems',
    level: 'Junior to Senior',
    topics: 'End-to-end architectures, auth flows, event-driven pipelines, full-stack debugging',
    questions: '160+ questions',
  },
  {
    role: 'AI & Machine Learning',
    level: 'Mid to Senior',
    topics: 'LLM orchestration, vector retrieval, embeddings, inference latency trade-offs',
    questions: '90+ questions',
  },
]

const rubricCategories = [
  { name: 'Architecture & System Design', score: '9.2 / 10', detail: 'Consistent fault tolerance and state handling' },
  { name: 'Technical Depth & Edge Cases', score: '8.8 / 10', detail: 'Proactive handling of concurrent race conditions' },
  { name: 'Communication & Structuring', score: '9.0 / 10', detail: 'Structured rationale and concise delivery' },
]

const steps = [
  {
    number: '01',
    title: 'Select Role & Seniority',
    description: 'Configure your preparation path based on your target position and experience baseline.',
  },
  {
    number: '02',
    title: 'Run Structured Simulations',
    description: 'Engage with progressive technical questions under realistic session constraints.',
  },
  {
    number: '03',
    title: 'Inspect Diagnostic Rubrics',
    description: 'Receive quantitative evaluations on conceptual accuracy, edge cases, and rationale.',
  },
  {
    number: '04',
    title: 'Track Performance Velocity',
    description: 'Review historical logs and pinpoint recurring weak areas across repeated attempts.',
  },
]

const Home = () => {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 selection:bg-stone-200">

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 text-white font-mono text-xs font-bold shadow-xs">
              M
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-stone-900 tracking-tight">MockMate Pro</span>
              <span className="hidden sm:inline-block rounded border border-stone-200 bg-stone-100 px-1.5 py-0.2 text-[10px] font-medium text-stone-600">
                v2.1
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-stone-600">
            <a href="#tracks" className="hover:text-stone-900 transition-colors">Role Tracks</a>
            <a href="#rubrics" className="hover:text-stone-900 transition-colors">Evaluation Rubrics</a>
            <a href="#workflow" className="hover:text-stone-900 transition-colors">Workflow</a>
            <Link to="/premium" className="hover:text-stone-900 transition-colors">Access Plans</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-950 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-primary !px-3.5 !py-1.5 text-xs"
            >
              Create Account
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 lg:pt-20 lg:pb-16">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-600 shadow-xs mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-stone-900" />
                <span className="font-medium text-stone-900">Standardized Interview Practice</span>
                <span className="text-stone-300">/</span>
                <span>Engineering & Product</span>
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-stone-950 sm:text-4xl lg:text-5xl lg:leading-[1.15]">
                Technical interview preparation built for modern hiring standards.
              </h1>

              <p className="mt-5 text-sm sm:text-base leading-relaxed text-stone-600 max-w-xl">
                MockMate Pro simulates role-specific technical screens, timed algorithmic and architectural drills, and benchmarks your verbal or typed responses against real engineering rubrics.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/register"
                  className="btn-primary !px-5 !py-2.5 text-xs font-semibold"
                >
                  Start a Practice Session
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                <a
                  href="#tracks"
                  className="btn-secondary !px-4 !py-2.5 text-xs font-medium"
                >
                  Explore Role Curriculums
                </a>
              </div>

              {/* Minimalist Metrics Strip */}
              <div className="mt-12 grid grid-cols-3 gap-6 border-t border-stone-200 pt-6">
                <div>
                  <div className="text-xl font-bold text-stone-900 tracking-tight">12+</div>
                  <div className="text-xs text-stone-500 mt-0.5">Role tracks</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-stone-900 tracking-tight">500+</div>
                  <div className="text-xs text-stone-500 mt-0.5">Technical prompts</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-stone-900 tracking-tight">3-Tier</div>
                  <div className="text-xs text-stone-500 mt-0.5">Seniority grading</div>
                </div>
              </div>
            </div>

            {/* Realistic Technical Assessment UI Preview */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span className="text-xs font-semibold text-stone-900">Live Assessment Session</span>
                </div>
                <span className="font-mono text-xs text-stone-500">14:28 remaining</span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                  <span>Track: Senior Backend Engineer</span>
                  <span className="font-medium text-stone-900">Question 3 of 8</span>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50/70 p-3.5 text-xs leading-relaxed text-stone-800">
                  <p className="font-medium text-stone-950 mb-1.5">
                    "How would you ensure idempotency across distributed webhook deliveries when handling database write timeouts?"
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Candidate evaluation focuses on storage layer transactions, unique constraints, idempotency keys, and reconciliation workers.
                  </p>
                </div>

                {/* Scorecard Preview */}
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                  <div className="text-[11px] font-semibold text-stone-700 uppercase tracking-wider">Evaluation Rubric</div>
                  {rubricCategories.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between rounded-md border border-stone-100 bg-white px-3 py-2 text-xs">
                      <div>
                        <div className="font-medium text-stone-800">{cat.name}</div>
                        <div className="text-[10px] text-stone-400">{cat.detail}</div>
                      </div>
                      <span className="font-mono font-semibold text-stone-900">{cat.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Role Curriculums Section */}
        <section id="tracks" className="border-t border-stone-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Curriculums</span>
              <h2 className="text-2xl font-bold tracking-tight text-stone-950 mt-1">
                Engineered for technical specialties
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-2">
                Questions are organized into concrete domain tracks covering architectural trade-offs, language internals, and production failure modes.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tracks.map((t) => (
                <div key={t.role} className="rounded-xl border border-stone-200 bg-stone-50/40 p-5 hover:border-stone-400 transition-colors">
                  <div className="text-xs font-bold text-stone-900">{t.role}</div>
                  <div className="text-[11px] font-medium text-stone-500 mt-0.5">{t.level}</div>
                  <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                    {t.topics}
                  </p>
                  <div className="mt-4 pt-3 border-t border-stone-200/60 text-[11px] font-semibold text-stone-800">
                    {t.questions}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="border-t border-stone-200 bg-stone-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Execution</span>
              <h2 className="text-2xl font-bold tracking-tight text-stone-950 mt-1">
                A structured practice lifecycle
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-2">
                Move methodically from role configuration to quantitative rubric analysis and historical tracking.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s) => (
                <div key={s.number} className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs">
                  <div className="font-mono text-xs font-bold text-stone-400">{s.number}</div>
                  <h3 className="text-xs font-bold text-stone-900 mt-2">{s.title}</h3>
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                    {s.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Bar */}
        <section className="border-t border-stone-200 bg-white py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-xl font-bold text-stone-950 sm:text-2xl">
              Ready to benchmark your interview readiness?
            </h2>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-2">
              Start practicing with standard question tracks or configure a live simulation round in minutes.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/register" className="btn-primary !px-5 text-xs font-semibold">
                Get Started Free
              </Link>
              <Link to="/login" className="btn-secondary !px-4 text-xs font-medium">
                Log In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-stone-50 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div>
            <span className="font-bold text-stone-900">MockMate Pro</span>
            <span className="mx-2 text-stone-300">·</span>
            <span>Built by <strong>Aditya Singh</strong></span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="mailto:sadityasingh7990@gmail.com"
              className="font-medium text-stone-700 hover:text-stone-950 hover:underline underline-offset-2 transition-colors"
            >
              sadityasingh7990@gmail.com
            </a>
            <span>© 2026 All rights reserved</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
