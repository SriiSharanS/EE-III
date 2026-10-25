import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProblems } from '../api';
import FilterBar from '../components/FilterBar';
import Navbar from '../components/Navbar';
import ProblemCard from '../components/ProblemCard';
import type { Language, Problem, Topic } from '../types/problem';

export default function AssessmentPage({
  attemptedProblemIds,
}: {
  attemptedProblemIds: ReadonlySet<number>;
}) {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>('Java');
  const [difficulty, setDifficulty] = useState('All');
  const [topic, setTopic] = useState<Topic | 'All Topics'>('All Topics');
  const [search, setSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [problemLoad, setProblemLoad] = useState<
    | { attempt: number; status: 'loading' }
    | { attempt: number; status: 'success'; problems: Problem[] }
    | { attempt: number; status: 'error'; message: string }
  >({ attempt: 0, status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetchProblems(controller.signal)
      .then((loadedProblems) => {
        setProblemLoad({ attempt: retryCount, status: 'success', problems: loadedProblems });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProblemLoad({
            attempt: retryCount,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load problems.',
          });
        }
      });

    return () => controller.abort();
  }, [retryCount]);

  const currentProblemLoad = problemLoad.attempt === retryCount ? problemLoad : null;
  const isLoading = !currentProblemLoad || currentProblemLoad.status === 'loading';
  const loadError = currentProblemLoad?.status === 'error' ? currentProblemLoad.message : null;

  const filteredProblems = useMemo(() => {
    if (currentProblemLoad?.status !== 'success') return [];
    return currentProblemLoad.problems.filter((problem) => {
      const matchesLanguage = problem.starterCode[language] !== undefined;
      const matchesDifficulty = difficulty === 'All' || problem.difficulty === difficulty;
      const matchesTopic = topic === 'All Topics' || problem.topic === topic;
      const query = search.trim().toLowerCase();
      const matchesSearch =
        problem.title.toLowerCase().includes(query) || problem.topic.toLowerCase().includes(query);
      return matchesLanguage && matchesDifficulty && matchesTopic && matchesSearch;
    });
  }, [currentProblemLoad, difficulty, language, search, topic]);

  return (
    <div className="app-shell">
      {/* Ambient background glows */}
      <div className="ambient-glow glow-top" aria-hidden="true" />
      <div className="ambient-glow glow-bottom" aria-hidden="true" />

      <Navbar />

      <main className="assessment-page">
        {/* Hero Section */}
        <section className="page-head assessment-hero">
          <div className="hero-copy">
            {/* Pill Badge */}
            <div
              className="badge appear appear--pop"
              style={{ '--d': '0.15s' } as React.CSSProperties}
            >
              <svg viewBox="0 0 24 24" className="badge-star" aria-hidden="true">
                <path
                  d="M12 2.6C12.55 2.6 12.88 3.15 13.08 4.7c.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22C11.12 3.15 11.45 2.6 12 2.6Z"
                  fill="currentColor"
                />
              </svg>
              <span>Automated Java Assessment Engine</span>
            </div>

            {/* H1 Heading */}
            <h1 className="hero-h1">
              <span
                className="headline-line appear appear--mask"
                style={{ '--d': '0.3s' } as React.CSSProperties}
              >
                Coding <em>Assessment</em> Workspace
              </span>
            </h1>

            {/* Lede Subtitle */}
            <p
              className="lede appear appear--soft"
              style={{ '--d': '0.45s' } as React.CSSProperties}
            >
              Execute real Java code with direct JDK compilation, standard I/O stream processing, and diagnostic feedback.
            </p>
          </div>

          {/* Hero Action */}
          <div
            className="hero-action-wrap appear appear--btn"
            style={{ '--d': '0.55s' } as React.CSSProperties}
          >
            <button
              type="button"
              className="btn btn-solid continue-btn"
              onClick={() => navigate('/code/1')}
            >
              <span>Continue Coding</span>
              <svg viewBox="0 0 24 24" className="btn-arrow-icon" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </section>

        {/* Feature Stats Metric Row */}
        <section className="stats-row">
          <div
            className="stat-card appear appear--stat"
            style={{ '--d': '0.65s' } as React.CSSProperties}
          >
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 24 24" className="stat-icon" aria-hidden="true">
                <rect x="3.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="currentColor" fillOpacity="0.4" />
                <rect x="13.4" y="2.6" width="7.2" height="18.8" rx="3.6" fill="currentColor" fillOpacity="0.8" />
                <rect x="9.2" y="10.9" width="5.6" height="2.2" rx="1.1" fill="currentColor" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">JDK 17.0.12 LTS</span>
              <span className="stat-sub">Subprocess Isolated Engine</span>
            </div>
          </div>

          <div
            className="stat-card appear appear--stat"
            style={{ '--d': '0.75s' } as React.CSSProperties}
          >
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 24 24" className="stat-icon" aria-hidden="true">
                <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="6.2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
                <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">100% Real Diagnostics</span>
              <span className="stat-sub">Live Javac Compiler Output</span>
            </div>
          </div>

          <div
            className="stat-card appear appear--stat"
            style={{ '--d': '0.85s' } as React.CSSProperties}
          >
            <div className="stat-icon-wrap">
              <svg viewBox="0 0 24 24" className="stat-icon" aria-hidden="true">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-info">
              <span className="stat-label">Real-time IO Stream</span>
              <span className="stat-sub">Custom stdin & stdout execution</span>
            </div>
          </div>
        </section>

        {/* Filter Controls Bar */}
        <div
          className="appear appear--soft"
          style={{ '--d': '0.92s' } as React.CSSProperties}
        >
          <FilterBar
            language={language}
            difficulty={difficulty}
            topic={topic}
            search={search}
            onLanguageChange={setLanguage}
            onDifficultyChange={setDifficulty}
            onTopicChange={setTopic}
            onSearchChange={setSearch}
          />
        </div>

        {/* Problem List Table */}
        <section
          className="table-wrapper appear appear--soft"
          style={{ '--d': '1.02s' } as React.CSSProperties}
        >
          <div className="table-header-meta">
            <span className="table-count-label">
              {isLoading || loadError
                ? 'Problem list'
                : <>Showing <b>{filteredProblems.length}</b> problem{filteredProblems.length === 1 ? '' : 's'}</>}
            </span>
          </div>

          <table className="problem-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Question</th>
                <th>Difficulty</th>
                <th>Topic</th>
                <th>Marks</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} role="status">Loading problems…</td></tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} role="alert">
                    <p>Could not load problems: {loadError}</p>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setRetryCount((count) => count + 1)}
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filteredProblems.length === 0 ? (
                <tr><td colSpan={7}>No problems match the selected filters.</td></tr>
              ) : (
                filteredProblems.map((problem) => (
                  <ProblemCard
                    key={problem.id}
                    problem={
                      attemptedProblemIds.has(problem.id)
                        ? { ...problem, status: 'Attempted' }
                        : problem
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
