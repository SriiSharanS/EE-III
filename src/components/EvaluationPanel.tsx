interface EvaluationPanelProps {
  visible: boolean;
  onReview: () => void;
  onBack: () => void;
}

export default function EvaluationPanel({ visible, onReview, onBack }: EvaluationPanelProps) {
  if (!visible) return null;

  return (
    <div className="modal-backdrop">
      <section className="evaluation-panel">
        <div className="evaluation-header">
          <span className="evaluation-title">Assessment Result</span>
          <span className="evaluation-close">×</span>
        </div>

        <div className="score-block">
          <div className="score-row">
            <span className="score-label">Score:</span>
            <span className="score-number">72 / 100</span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: '72%' }}></div>
          </div>
        </div>

        <div className="breakdown-grid">
          <div className="breakdown-row"><span>Syntax Correctness</span><span>10 / 10</span></div>
          <div className="breakdown-row"><span>Logic Correctness</span><span>18 / 30</span></div>
          <div className="breakdown-row"><span>Test Cases</span><span>25 / 30</span></div>
          <div className="breakdown-row"><span>Time Complexity</span><span>7 / 10</span></div>
          <div className="breakdown-row"><span>Space Complexity</span><span>7 / 10</span></div>
          <div className="breakdown-row"><span>Code Quality</span><span>5 / 10</span></div>
        </div>

        <div className="passed-row">
          <span>Test Cases Passed:</span>
          <span><b>7 / 10</b></span>
        </div>

        <div className="evaluation-actions">
          <button className="review-button" onClick={onReview}>Review Code</button>
          <button className="back-button" onClick={onBack}>Back to Problems</button>
        </div>
      </section>
    </div>
  );
}
