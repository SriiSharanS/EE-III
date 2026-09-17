import type { Language, Topic } from '../types/problem';

interface FilterBarProps {
  language: Language;
  difficulty: string;
  topic: Topic | 'All Topics';
  search: string;
  onLanguageChange: (language: Language) => void;
  onDifficultyChange: (difficulty: string) => void;
  onTopicChange: (topic: Topic | 'All Topics') => void;
  onSearchChange: (search: string) => void;
}

const languages: Language[] = ['Java'];
const difficulties = ['All', 'Easy', 'Medium', 'Hard'];
const topics: Array<Topic | 'All Topics'> = [
  'All Topics',
  'Basics',
  'Conditions',
  'Loops',
  'Arrays',
  'Strings',
  'Functions',
  'DSA',
];

export default function FilterBar({
  language,
  difficulty,
  topic,
  search,
  onLanguageChange,
  onDifficultyChange,
  onTopicChange,
  onSearchChange,
}: FilterBarProps) {
  return (
    <section className="filter-bar">
      <div className="filters-grid">
        <label className="filter-control">
          <span className="filter-label">Language</span>
          <div className="select-wrap">
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="filter-select"
            >
              {languages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="filter-control">
          <span className="filter-label">Difficulty</span>
          <div className="select-wrap">
            <select
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value)}
              className="filter-select"
            >
              {difficulties.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="filter-control">
          <span className="filter-label">Topic</span>
          <div className="select-wrap">
            <select
              value={topic}
              onChange={(e) => onTopicChange(e.target.value as Topic | 'All Topics')}
              className="filter-select"
            >
              {topics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="filter-control search-control">
          <span className="filter-label">Search Query</span>
          <div className="search-input-wrap">
            <svg viewBox="0 0 24 24" className="search-icon" aria-hidden="true">
              <path
                d="m18 18-4.2-4.2M16 11a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
            <input
              className="filter-input"
              value={search}
              placeholder="Filter by title or topic..."
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </label>
      </div>
    </section>
  );
}
