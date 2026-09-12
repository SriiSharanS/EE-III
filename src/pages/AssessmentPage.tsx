import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import Navbar from '../components/Navbar';
import ProblemCard from '../components/ProblemCard';
import { mockProblems } from '../data/mockProblems';
import type { Language, Topic } from '../types/problem';

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<Language>('Python');
  const [difficulty, setDifficulty] = useState('All');
  const [topic, setTopic] = useState<Topic | 'All Topics'>('All Topics');
  const [search, setSearch] = useState('');

  const filteredProblems = useMemo(() => {
    return mockProblems.filter((problem) => {
      const matchesLanguage = problem.starterCode[language] !== undefined;
      const matchesDifficulty = difficulty === 'All' || problem.difficulty === difficulty;
      const matchesTopic = topic === 'All Topics' || problem.topic === topic;
      const query = search.trim().toLowerCase();
      const matchesSearch = problem.title.toLowerCase().includes(query) || problem.topic.toLowerCase().includes(query);
      return matchesLanguage && matchesDifficulty && matchesTopic && matchesSearch;
    });
  }, [difficulty, language, search, topic]);

  return (
    <div className="app-shell">
      <Navbar />
      <main className="assessment-page">
        <section className="page-head">
          <div>
            <span className="section-kicker">Assessment Workspace</span>
            <h1>Coding Assessment</h1>
            <p className="page-subtitle">Choose a problem and start coding.</p>
          </div>
          <button className="new-problem-button" onClick={() => navigate('/code/1')}>Continue Coding</button>
        </section>

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

        <section className="table-wrapper">
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
              {filteredProblems.map((problem) => (
                <ProblemCard key={problem.id} problem={problem} />
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
