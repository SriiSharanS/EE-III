import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import type { EvaluationResult, SubmissionResponse } from '../types/problem';

interface EvaluationPanelProps {
  visible: boolean;
  evaluation: EvaluationResult | null;
  verdict: SubmissionResponse | null;
  isFeedbackLoading: boolean;
  feedbackError: string | null;
  onRetryFeedback: () => void;
  code: string;
  problemTitle: string;
  onClose: () => void;
  onBack: () => void;
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="ai-insight-card suggestions-card">
      <div className="insight-card-header">
        <span>{title}</span>
      </div>
      <ul className="insight-list">
        {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function DetailedFeedbackSections({
  evaluation,
  verdict,
}: {
  evaluation: EvaluationResult;
  verdict: SubmissionResponse;
}) {
  const feedback = evaluation.detailedFeedback;

  return (
    <>
      <div className="ai-insight-card summary-card">
        <div className="insight-card-header"><span>Overall Assessment</span></div>
        <p className="summary-text">{feedback.overallAssessment}</p>
        <p className="summary-text">{feedback.verdictExplanation}</p>
      </div>

      <div className="ai-insight-card summary-card">
        <div className="insight-card-header"><span>Correctness & Logic Analysis</span></div>
        <p className="summary-text">{feedback.correctnessAnalysis}</p>
      </div>

      <div className="ai-insight-card issues-card">
        <div className="insight-card-header"><span>Failed Test Explanations</span></div>
        {verdict.testCasesTotal === 0 ? (
          <p className="summary-text">No test-case evidence was provided.</p>
        ) : feedback.failedTests.length === 0 ? (
          <p className="summary-text">All {verdict.testCasesPassed} supplied test cases passed.</p>
        ) : (
          <ul className="insight-list">
            {feedback.failedTests.map((test) => (
              <li key={test.testCaseNumber}>
                <strong>Test {test.testCaseNumber}</strong>
                <div>Input: <code>{test.input || '(empty input)'}</code></div>
                <div>Expected: <code>{test.expectedOutput || '(empty output)'}</code></div>
                <div>Actual: <code>{test.actualOutput || '(empty output)'}</code></div>
                <div>{test.explanation}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="ai-insight-card summary-card">
        <div className="insight-card-header"><span>Time & Space Complexity</span></div>
        <p className="summary-text">
          Time: {evaluation.timeComplexity} — {feedback.timeComplexityReasoning}
        </p>
        <p className="summary-text">
          Space: {evaluation.spaceComplexity} — {feedback.spaceComplexityReasoning}
        </p>
      </div>

      <FeedbackList title="Code Quality Strengths" items={feedback.codeQualityStrengths} />
      <FeedbackList title="Code Quality Improvements" items={feedback.codeQualityImprovements} />
      <FeedbackList title="Specific Mistakes" items={feedback.specificMistakes} />
      <FeedbackList title="Actionable Corrections" items={feedback.correctionGuidance} />
      <FeedbackList title="Java Concepts to Review" items={feedback.javaConceptsToReview} />

      <div className="ai-insight-card summary-card">
        <div className="insight-card-header"><span>Follow-up Practice</span></div>
        <p className="summary-text">{feedback.practiceRecommendation}</p>
      </div>
    </>
  );
}

function StudentImprovementReport({
  evaluation,
  verdict,
  problemTitle,
}: {
  evaluation: EvaluationResult;
  verdict: SubmissionResponse;
  problemTitle: string;
}) {
  const feedback = evaluation.detailedFeedback;
  const reportItems = useMemo(() => {
    const items = [
      ...(feedback.codeQualityImprovements || []),
      ...(feedback.correctionGuidance || []),
      ...(feedback.specificMistakes || []),
      ...(feedback.javaConceptsToReview || []),
    ].filter(Boolean);

    return items.slice(0, 6);
  }, [feedback]);

  const spaceFocus = feedback.spaceComplexityReasoning || 'No major space issue was detected.';
  const currentSpace = evaluation.spaceComplexity || 'O(1)';

  return (
    <div className="latex-report">
      <div className="latex-header">
        <div>
          <div className="latex-kicker">Student Improvement Report</div>
          <h3>{problemTitle}</h3>
        </div>
        <div className="report-pills">
          <span className="report-pill report-pill-primary">Score: {evaluation.totalScore}/100</span>
          <span className="report-pill report-pill-accent">Verdict: {verdict.verdict}</span>
        </div>
      </div>

      <div className="latex-section">
        <div className="latex-section-title">1. Problem Summary</div>
        <p>{feedback.overallAssessment}</p>
        <p>{feedback.verdictExplanation}</p>
      </div>

      <div className="latex-grid two-col">
        <div className="latex-section">
          <div className="latex-section-title">2. Current Performance</div>
          <div className="latex-metric-row">
            <span>Correctness</span>
            <strong>{evaluation.correctness}</strong>
          </div>
          <div className="latex-metric-row">
            <span>Time</span>
            <strong>{evaluation.timeComplexity}</strong>
          </div>
          <div className="latex-metric-row">
            <span>Space</span>
            <strong>{currentSpace}</strong>
          </div>
        </div>

        <div className="latex-section">
          <div className="latex-section-title">3. Space Improvement Focus</div>
          <div className="latex-equation">{`$\\text{Space focus} = ${currentSpace}$`}</div>
          <p>{spaceFocus}</p>
        </div>
      </div>

      <div className="latex-section">
        <div className="latex-section-title">4. Main Gaps to Improve</div>
        <ul className="latex-bullets">
          {reportItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="latex-section">
        <div className="latex-section-title">5. Suggested Learning Path</div>
        <p>{feedback.practiceRecommendation}</p>
        <div className="latex-sticky-note">
          <strong>Key takeaway:</strong> Improve memory efficiency by reducing extra structures, reusing inputs wisely, and keeping the algorithm focused on the core data needed for the solution.
        </div>
      </div>
    </div>
  );
}

export default function EvaluationPanel({
  visible,
  evaluation,
  verdict,
  isFeedbackLoading,
  feedbackError,
  onRetryFeedback,
  code,
  problemTitle,
  onClose,
  onBack,
}: EvaluationPanelProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'review'>('summary');

  const downloadPdfReport = () => {
    if (!evaluation || !verdict) return;

    const feedback = evaluation.detailedFeedback;
    const items = [
      ...(feedback.codeQualityImprovements || []),
      ...(feedback.correctionGuidance || []),
      ...(feedback.specificMistakes || []),
      ...(feedback.javaConceptsToReview || []),
    ].filter(Boolean).slice(0, 6);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    let y = 20;

    const addWrappedText = (text: string, x: number, startY: number, maxWidth: number, lineHeight = 6) => {
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (startY > 280) {
          doc.addPage();
          startY = 20;
        }
        doc.text(line, x, startY);
        startY += lineHeight;
      });
      return startY;
    };

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Student Improvement Report', margin, 13);
    doc.setFontSize(11);
    doc.text(problemTitle, margin, 22);

    doc.setTextColor(15, 23, 42);
    y = 38;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Problem Overview', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
    y = addWrappedText(`Problem: ${problemTitle}`, margin, y, pageWidth - margin * 2);
    y = addWrappedText(`Score: ${evaluation.totalScore}/100`, margin, y + 2, pageWidth - margin * 2);
    y = addWrappedText(`Verdict: ${verdict.verdict}`, margin, y + 2, pageWidth - margin * 2);
    y = addWrappedText(`Time Complexity: ${evaluation.timeComplexity || 'O(n)'}`, margin, y + 2, pageWidth - margin * 2);
    y = addWrappedText(`Space Complexity: ${evaluation.spaceComplexity || 'O(1)'}`, margin, y + 2, pageWidth - margin * 2);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Overall Assessment', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
    y = addWrappedText(feedback.overallAssessment || 'No overall assessment available.', margin, y, pageWidth - margin * 2, 6);
    y = addWrappedText(feedback.verdictExplanation || 'No verdict explanation is available.', margin, y + 2, pageWidth - margin * 2, 6);

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Space Improvement Focus', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
    y = addWrappedText(`Space focus = ${evaluation.spaceComplexity || 'O(1)'}`, margin, y, pageWidth - margin * 2, 6);
    y = addWrappedText(feedback.spaceComplexityReasoning || 'No major space issue was detected.', margin, y + 2, pageWidth - margin * 2, 6);

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Main Gaps to Improve', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
    if (items.length > 0) {
      items.forEach((item) => {
        y = addWrappedText(`• ${item}`, margin + 4, y, pageWidth - margin * 2 - 10, 6);
      });
    } else {
      y = addWrappedText('• No additional gaps were reported.', margin + 4, y, pageWidth - margin * 2 - 10, 6);
    }

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Suggested Learning Path', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 8;
    y = addWrappedText(feedback.practiceRecommendation || 'Continue practicing core algorithmic patterns and memory-efficient data structures.', margin, y, pageWidth - margin * 2, 6);

    doc.save(`${problemTitle.replace(/\s+/g, '-').toLowerCase()}-report.pdf`);
  };

  if (!visible || !verdict) return null;

  const scorePercentage = evaluation
    ? Math.max(0, Math.min(100, evaluation.totalScore))
    : 0;
  const showSummaryView = viewMode === 'summary' || !evaluation;

  const getScoreBadgeClass = (score: number) => {
    if (score >= 90) return 'badge-success';
    if (score >= 70) return 'badge-info';
    if (score >= 50) return 'badge-warning';
    return 'badge-danger';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent Solution';
    if (score >= 75) return 'Good Attempt';
    if (score >= 50) return 'Partial Solution';
    return 'Needs Improvement';
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <section
        className="evaluation-panel modal-panel appear appear--pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="evaluation-header">
          <div className="evaluation-header-left">
            <span className="evaluation-kicker">AI Code Evaluation</span>
            <h2 className="evaluation-title">Assessment Result</h2>
            <span className="evaluation-problem-title">{problemTitle}</span>
          </div>
          <button
            type="button"
            className="evaluation-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* View Toggle */}
        <div className="eval-view-toggle">
          <button
            type="button"
            className={`eval-tab-btn ${showSummaryView ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            Evaluation Summary
          </button>
          <button
            type="button"
            className={`eval-tab-btn ${viewMode === 'review' ? 'active' : ''}`}
            onClick={() => setViewMode('review')}
            disabled={!evaluation}
          >
            Review Code & Insights
          </button>
        </div>

        {showSummaryView ? (
          isFeedbackLoading && !evaluation ? (
            <div className="eval-scroll-content">
              <div className="ai-loading-card" aria-live="polite">
                <div className="ai-loading-spinner" />
                <div className="ai-loading-title">AI evaluation is running</div>
                <p className="ai-loading-subtitle">Analyzing correctness, complexity, and the student improvement report…</p>
                <div className="ai-loading-bars" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="ai-loading-steps">
                  <span>Checking logic</span>
                  <span>Reviewing space usage</span>
                  <span>Preparing report</span>
                </div>
              </div>
            </div>
          ) : evaluation ? (
            <div className="eval-scroll-content">
              <div className="score-block">
                <div className="score-row">
                  <div className="score-heading-group">
                    <span className="score-label">TOTAL SCORE</span>
                    <span className={`score-badge ${getScoreBadgeClass(evaluation.totalScore)}`}>
                      {getScoreLabel(evaluation.totalScore)}
                    </span>
                  </div>
                  <div className="score-number-display">
                    <span className="score-huge">{evaluation.totalScore}</span>
                    <span className="score-max">/ 100</span>
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${scorePercentage}%` }}
                  />
                </div>
              </div>

              <div className="eval-section-title">Evaluation Breakdown</div>
              <div className="breakdown-grid">
                <div className="breakdown-row">
                  <span className="breakdown-name">
                    <span className="dot dot-syntax" /> Syntax Correctness
                  </span>
                  <span className="breakdown-score"><b>{evaluation.syntaxScore}</b> / 10</span>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-name">
                    <span className="dot dot-logic" /> Logic Correctness
                  </span>
                  <span className="breakdown-score"><b>{evaluation.logicScore}</b> / 30</span>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-name">
                    <span className="dot dot-tests" /> Test Cases
                  </span>
                  <span className="breakdown-score"><b>{evaluation.testCaseScore}</b> / 30</span>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-name">
                    <span className="dot dot-time" /> Time Complexity
                  </span>
                  <span className="breakdown-score"><b>{evaluation.timeComplexityScore}</b> / 10</span>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-name">
                    <span className="dot dot-space" /> Space Complexity
                  </span>
                  <span className="breakdown-score"><b>{evaluation.spaceComplexityScore}</b> / 10</span>
                </div>
                <div className="breakdown-row">
                  <span className="breakdown-name">
                    <span className="dot dot-quality" /> Code Quality
                  </span>
                  <span className="breakdown-score"><b>{evaluation.codeQualityScore}</b> / 10</span>
                </div>
              </div>

              <div className="metrics-triplet">
                <div className="metric-chip">
                  <span className="metric-chip-label">Test Cases Passed</span>
                  <span className="metric-chip-val">
                    {evaluation.testCasesPassed} / {evaluation.testCasesTotal}
                  </span>
                </div>
                <div className="metric-chip">
                  <span className="metric-chip-label">Time Complexity</span>
                  <span className="metric-chip-val code-val">{evaluation.timeComplexity || 'O(n)'}</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-chip-label">Space Complexity</span>
                  <span className="metric-chip-val code-val">{evaluation.spaceComplexity || 'O(1)'}</span>
                </div>
              </div>

              <StudentImprovementReport evaluation={evaluation} verdict={verdict} problemTitle={problemTitle} />

              <DetailedFeedbackSections evaluation={evaluation} verdict={verdict} />

              {evaluation.summary && (
                <div className="ai-insight-card summary-card">
                  <div className="insight-card-header">
                    <svg className="insight-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>AI Evaluation Summary</span>
                  </div>
                  <p className="summary-text">{evaluation.summary}</p>
                </div>
              )}

              {evaluation.strengths && evaluation.strengths.length > 0 && (
                <div className="ai-insight-card strengths-card">
                  <div className="insight-card-header">
                    <svg className="insight-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Strengths</span>
                  </div>
                  <ul className="insight-list">
                    {evaluation.strengths.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.issues && evaluation.issues.length > 0 && (
                <div className="ai-insight-card issues-card">
                  <div className="insight-card-header">
                    <svg className="insight-icon warning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Issues & Bottlenecks</span>
                  </div>
                  <ul className="insight-list">
                    {evaluation.issues.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.suggestions && evaluation.suggestions.length > 0 && (
                <div className="ai-insight-card suggestions-card">
                  <div className="insight-card-header">
                    <svg className="insight-icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Suggestions for Improvement</span>
                  </div>
                  <ul className="insight-list">
                    {evaluation.suggestions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="eval-scroll-content">
              <div className="metrics-triplet">
                <div className="metric-chip">
                  <span className="metric-chip-label">Java Test Verdict</span>
                  <span className="metric-chip-val">{verdict.verdict.replaceAll('_', ' ').toUpperCase()}</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-chip-label">Test Cases Passed</span>
                  <span className="metric-chip-val">{verdict.testCasesPassed} / {verdict.testCasesTotal}</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-chip-label">Java Execution</span>
                  <span className="metric-chip-val">{verdict.execution.status.replaceAll('_', ' ')}</span>
                </div>
              </div>

              <div className="ai-insight-card summary-card">
                <div className="insight-card-header">
                  <span>Actual Test Results</span>
                </div>
                <ul className="insight-list">
                  {verdict.testCases.map((testCase, index) => (
                    <li key={index}>
                      Test {index + 1}: {testCase.passed ? 'Passed' : 'Failed'}
                      {!testCase.passed && testCase.actualOutput && ` — ${testCase.actualOutput.trim()}`}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="ai-insight-card summary-card" aria-live="polite">
                <div className="insight-card-header">
                  <span>Gemini AI Feedback</span>
                </div>
                {isFeedbackLoading && <p className="summary-text">Generating educational feedback. Your Java verdict is already available.</p>}
                {feedbackError && (
                  <>
                    <p className="summary-text">{feedbackError}</p>
                    <button type="button" className="btn btn-ghost" onClick={onRetryFeedback}>
                      Retry AI Feedback
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        ) : (
          /* Code Review Mode */
          <div className="eval-scroll-content review-mode-content">
            <div className="review-section">
              <div className="eval-section-title">Submitted Code</div>
              <pre className="submitted-code-block">
                <code>{code}</code>
              </pre>
            </div>

            {evaluation && <DetailedFeedbackSections evaluation={evaluation} verdict={verdict} />}

            <div className="review-insights-split">
              {evaluation?.issues && evaluation.issues.length > 0 && (
                <div className="ai-insight-card issues-card">
                  <div className="insight-card-header">
                    <span className="tag-error">Issues to Fix</span>
                  </div>
                  <ul className="insight-list">
                    {evaluation.issues.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation?.suggestions && evaluation.suggestions.length > 0 && (
                <div className="ai-insight-card suggestions-card">
                  <div className="insight-card-header">
                    <span className="tag-info">Recommended Improvements</span>
                  </div>
                  <ul className="insight-list">
                    {evaluation.suggestions.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="evaluation-actions">
          {evaluation && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={downloadPdfReport}
            >
              Download PDF Report
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setViewMode(showSummaryView ? 'review' : 'summary')}
          >
            {showSummaryView ? 'Review Code' : 'Back to Summary'}
          </button>
          <button
            type="button"
            className="btn btn-solid-white"
            onClick={onBack}
          >
            Back to Problems
          </button>
        </div>
      </section>
    </div>
  );
}
