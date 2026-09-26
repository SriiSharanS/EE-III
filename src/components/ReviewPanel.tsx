import type { EvaluationResult } from '../types/problem';

interface ReviewPanelProps {
  visible: boolean;
  evaluation?: EvaluationResult | null;
  code?: string;
  onClose?: () => void;
}

export default function ReviewPanel({ visible, evaluation, code, onClose }: ReviewPanelProps) {
  if (!visible || !evaluation) return null;

  return (
    <section className="review-panel">
      <div className="review-heading">
        <span>AI Code Review</span>
        {onClose && (
          <button type="button" className="review-close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {code && (
        <div className="review-code-container">
          <pre className="review-code-pre">
            <code>{code}</code>
          </pre>
        </div>
      )}

      <div className="review-info">
        {evaluation.issues && evaluation.issues.length > 0 && (
          <div className="review-question">
            <span className="review-label">Issues Detected:</span>
            <ul className="review-list">
              {evaluation.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {evaluation.suggestions && evaluation.suggestions.length > 0 && (
          <div className="review-question">
            <span className="review-label">AI Suggestions:</span>
            <ul className="review-list">
              {evaluation.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="review-category-list">
        <span className={`review-category ${evaluation.syntaxScore === 10 ? 'correct' : 'warning'}`}>
          Syntax: {evaluation.syntaxScore}/10
        </span>
        <span className={`review-category ${evaluation.logicScore >= 24 ? 'correct' : 'warning'}`}>
          Logic: {evaluation.logicScore}/30
        </span>
        <span className={`review-category ${evaluation.testCaseScore >= 24 ? 'correct' : 'warning'}`}>
          Tests: {evaluation.testCaseScore}/30
        </span>
        <span className="review-category">
          Time: {evaluation.timeComplexity || 'O(n)'}
        </span>
        <span className="review-category">
          Space: {evaluation.spaceComplexity || 'O(1)'}
        </span>
      </div>
    </section>
  );
}
