import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProblems } from '../api';
import FilterBar from '../components/FilterBar';
import GlassButton from '../components/GlassButton';
import Navbar from '../components/Navbar';
import ProblemCard from '../components/ProblemCard';
import type { Language, Problem, Topic } from '../types/problem';

export default function QuestionsPage({
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
      <div className="ambient-glow glow-top" aria-hidden="true" />
      <div className="ambient-glow glow-bottom" aria-hidden="true" />

      <Navbar />

      <main className="assessment-page">
        <GlassButton
          variant="secondary"
          size="md"
          style={{ marginBottom: '24px' }}
          onClick={() => navigate('/assessment')}
        >
          Back to Home
        </GlassButton>

        <div
          className="appear appear--soft"
          style={{ '--d': '0.1s' } as React.CSSProperties}
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

        <section
          className="table-wrapper appear appear--soft"
          style={{ '--d': '0.2s' } as React.CSSProperties}
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
                    <GlassButton
                      variant="secondary"
                      size="md"
                      onClick={() => setRetryCount((count) => count + 1)}
                    >
                      Retry
                    </GlassButton>
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