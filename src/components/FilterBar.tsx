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

const languages: Language[] = ['Python', 'Java', 'C', 'C++'];
const difficulties = ['Easy', 'Medium', 'Hard'];
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
          <select value={language} onChange={(e) => onLanguageChange(e.target.value as Language)}>
            {languages.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="filter-control">
          <span className="filter-label">Difficulty</span>
          <select value={difficulty} onChange={(e) => onDifficultyChange(e.target.value)}>
            <option>All</option>
            {difficulties.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="filter-control">
          <span className="filter-label">Topic</span>
          <select value={topic} onChange={(e) => onTopicChange(e.target.value as Topic | 'All Topics')}>
            {topics.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="filter-control search-control">
          <span className="filter-label">Search</span>
          <span className="search-input-wrap">
            <svg viewBox="0 0 24 24" className="search-icon">
              <path d="m18 18-4.2-4.2M16 11a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <input value={search} placeholder="Search problem" onChange={(e) => onSearchChange(e.target.value)} />
          </span>
        </label>
      </div>
    </section>
  );
}
