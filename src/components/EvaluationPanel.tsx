import { useState } from 'react';
import type { EvaluationResult } from '../types/problem';

interface EvaluationPanelProps {
  visible: boolean;
  evaluation: EvaluationResult | null;
  code: string;
  problemTitle: string;
  onClose: () => void;
  onBack: () => void;
}

export default function EvaluationPanel({
  visible,
  evaluation,
  code,
  problemTitle,
  onClose,
  onBack,
}: EvaluationPanelProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'review'>('summary');

  if (!visible || !evaluation) return null;

  const scorePercentage = Math.max(0, Math.min(100, evaluation.totalScore));
  
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
            className={`eval-tab-btn ${viewMode === 'summary' ? 'active' : ''}`}
            onClick={() => setViewMode('summary')}
          >
            Evaluation Summary
          </button>
          <button
            type="button"
            className={`eval-tab-btn ${viewMode === 'review' ? 'active' : ''}`}
            onClick={() => setViewMode('review')}
          >
            Review Code & Insights
          </button>
        </div>

        {viewMode === 'summary' ? (
          <div className="eval-scroll-content">
            {/* Total Score Block */}
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

            {/* 6 Category Breakdown Grid */}
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

            {/* Performance Stats Cards */}
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

            {/* Summary Section */}
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

            {/* Strengths */}
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

            {/* Issues */}
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

            {/* Suggestions */}
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
          /* Code Review Mode */
          <div className="eval-scroll-content review-mode-content">
            <div className="review-section">
              <div className="eval-section-title">Submitted Code</div>
              <pre className="submitted-code-block">
                <code>{code}</code>
              </pre>
            </div>

            <div className="review-insights-split">
              {evaluation.issues && evaluation.issues.length > 0 && (
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

              {evaluation.suggestions && evaluation.suggestions.length > 0 && (
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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setViewMode(viewMode === 'summary' ? 'review' : 'summary')}
          >
            {viewMode === 'summary' ? 'Review Code' : 'Back to Summary'}
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
