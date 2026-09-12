interface ReviewPanelProps {
  visible: boolean;
}

export default function ReviewPanel({ visible }: ReviewPanelProps) {
  if (!visible) return null;

  return (
    <section className="review-panel">
      <div className="review-heading">
        <span>Review Code</span>
        <span className="review-line-title">Line 4</span>
      </div>

      <div className="review-code">
        <code>if arr[i] &lt; maximum:</code>
      </div>

      <div className="review-info">
        <div className="review-question">
          <span className="review-label">Issue:</span>
          <span>Possible logical error.</span>
        </div>
        <div className="review-question">
          <span className="review-label">Suggestion:</span>
          <span>Check whether the comparison should update the maximum value when the current value is larger.</span>
        </div>
      </div>

      <div className="review-category-list">
        <span className="review-category">Syntax</span>
        <span className="review-category warning">Logic</span>
        <span className="review-category">Test Cases</span>
        <span className="review-category">Complexity</span>
        <span className="review-category">Code Quality</span>
      </div>

      <div className="review-status-grid">
        <span className="review-status status-correct">Correct</span>
        <span className="review-status status-warning">Warning</span>
        <span className="review-status status-error">Error</span>
      </div>
    </section>
  );
}
