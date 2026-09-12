import { useNavigate } from 'react-router-dom';
import type { Problem } from '../types/problem';

interface ProblemCardProps {
  problem: Problem;
}

export default function ProblemCard({ problem }: ProblemCardProps) {
  const navigate = useNavigate();
  return (
    <tr className="problem-row">
      <td className="problem-number">#{problem.number}</td>
      <td className="problem-title-cell">
        <span className="problem-title">{problem.title}</span>
      </td>
      <td>
        <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
      </td>
      <td className="topic-cell">{problem.topic}</td>
      <td className="marks-cell">{problem.marks}</td>
      <td>
        <span className={`status-badge ${problem.status === 'Attempted' ? 'status-attempted' : 'status-not-attempted'}`}>{problem.status}</span>
      </td>
      <td>
        <button className="solve-button" onClick={() => navigate(`/code/${problem.id}`)}>
          Solve
        </button>
      </td>
    </tr>
  );
}
