import { useNavigate } from 'react-router-dom';
import type { Problem } from '../types/problem';

interface ProblemCardProps {
  problem: Problem;
}

export default function ProblemCard({ problem }: ProblemCardProps) {
  const navigate = useNavigate();

  return (
    <tr className="problem-row">
      <td className="problem-number">
        <span className="number-pill">#{String(problem.number).padStart(2, '0')}</span>
      </td>
      <td className="problem-title-cell">
        <span className="problem-title" onClick={() => navigate(`/code/${problem.id}`)}>
          {problem.title}
        </span>
      </td>
      <td>
        <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>
          <span className="badge-dot"></span>
          {problem.difficulty}
        </span>
      </td>
      <td className="topic-cell">
        <span className="topic-tag">{problem.topic}</span>
      </td>
      <td className="marks-cell">
        <span className="marks-value">{problem.marks}</span> <span className="marks-unit">pts</span>
      </td>
      <td>
        <span
          className={`status-badge ${
            problem.status === 'Attempted' ? 'status-attempted' : 'status-not-attempted'
          }`}
        >
          {problem.status}
        </span>
      </td>
      <td>
        <button
          type="button"
          className="btn btn-ghost solve-button"
          onClick={() => navigate(`/code/${problem.id}`)}
        >
          <span>Solve</span>
          <svg viewBox="0 0 24 24" className="solve-icon" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
