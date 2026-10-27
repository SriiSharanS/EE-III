import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiUrl, fetchProblem, javaSubmissionTimeoutMs } from '../api';
import CodeEditor from '../components/CodeEditor';
import EvaluationPanel from '../components/EvaluationPanel';
import GlassButton, { ArrowRightIcon } from '../components/GlassButton';
import Navbar from '../components/Navbar';
import type { EvaluationResult, Problem, SubmissionResponse } from '../types/problem';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isEvaluationResult(value: unknown): value is EvaluationResult {
  if (!isRecord(value) || !isRecord(value.detailedFeedback)) return false;

  const scoreFields = [
    'totalScore',
    'syntaxScore',
    'logicScore',
    'testCaseScore',
    'timeComplexityScore',
    'spaceComplexityScore',
    'codeQualityScore',
    'testCasesPassed',
    'testCasesTotal',
  ];
  const textFields = [
    'correctness',
    'timeComplexity',
    'spaceComplexity',
    'summary',
  ];
  const detailed = value.detailedFeedback;
  const detailTextFields = [
    'overallAssessment',
    'verdictExplanation',
    'correctnessAnalysis',
    'timeComplexityReasoning',
    'spaceComplexityReasoning',
    'practiceRecommendation',
  ];
  const detailArrayFields = [
    'codeQualityStrengths',
    'codeQualityImprovements',
    'specificMistakes',
    'correctionGuidance',
    'javaConceptsToReview',
  ];

  return (
    scoreFields.every((field) => Number.isInteger(value[field])) &&
    textFields.every((field) => typeof value[field] === 'string') &&
    ['strengths', 'issues', 'suggestions'].every((field) =>
      isStringArray(value[field])
    ) &&
    detailTextFields.every((field) => typeof detailed[field] === 'string') &&
    detailArrayFields.every((field) => isStringArray(detailed[field])) &&
    Array.isArray(detailed.failedTests) &&
    detailed.failedTests.every(
      (test) =>
        isRecord(test) &&
        Number.isInteger(test.testCaseNumber) &&
        typeof test.input === 'string' &&
        typeof test.expectedOutput === 'string' &&
        typeof test.actualOutput === 'string' &&
        typeof test.explanation === 'string'
    )
  );
}

export default function CodingPage({
  onProblemAttempted,
}: {
  onProblemAttempted: (problemId: number) => void;
}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const problemId = Number(id);
  const hasValidId = Number.isSafeInteger(problemId) && problemId > 0;
  const [retryCount, setRetryCount] = useState(0);
  const requestKey = `${id ?? ''}:${retryCount}`;
  const [problemLoad, setProblemLoad] = useState<
    | { key: string; status: 'success'; problem: Problem }
    | { key: string; status: 'error'; message: string }
  >();

  useEffect(() => {
    const controller = new AbortController();
    if (!hasValidId) return () => controller.abort();
    fetchProblem(problemId, controller.signal)
      .then((loadedProblem) => {
        setProblemLoad({ key: requestKey, status: 'success', problem: loadedProblem });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setProblemLoad({
            key: requestKey,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load this problem.',
          });
        }
      });

    return () => controller.abort();
  }, [hasValidId, problemId, requestKey]);

  const currentProblemLoad = problemLoad?.key === requestKey ? problemLoad : null;
  const matchingProblem =
    currentProblemLoad?.status === 'success' && currentProblemLoad.problem.id === problemId
      ? currentProblemLoad.problem
      : null;
  const loadError = hasValidId
    ? currentProblemLoad?.status === 'error'
      ? currentProblemLoad.message
      : null
    : 'The requested problem ID is invalid.';
  const isLoading = hasValidId && !matchingProblem && !loadError;

  return matchingProblem ? (
    <CodingWorkspace
      key={matchingProblem.id}
      problem={matchingProblem}
      onProblemAttempted={onProblemAttempted}
    />
  ) : (
    <div className="app-shell">
      <div className="ambient-glow glow-top" aria-hidden="true" />
      <Navbar />
      <main className="coding-page">
        <section className="page-head coding-head" aria-live="polite">
          <div>
            <h1 className="coding-problem-title">
              {loadError ? 'Problem unavailable' : 'Loading problem…'}
            </h1>
            {loadError && <p role="alert">{loadError}</p>}
            {!loadError && isLoading && <p role="status">Loading problem details…</p>}
          </div>
          <div className="coding-header-meta">
            {loadError && hasValidId && (
              <GlassButton
                variant="secondary"
                size="md"
                onClick={() => setRetryCount((count) => count + 1)}
              >
                Retry
              </GlassButton>
            )}
            <GlassButton
              variant="ghost"
              size="md"
              className="back-to-list"
              icon={<ArrowRightIcon />}
              onClick={() => navigate('/assessment')}
            >
              Back to Problems
            </GlassButton>
          </div>
        </section>
      </main>
    </div>
  );
}

function CodingWorkspace({
  problem,
  onProblemAttempted,
}: {
  problem: Problem;
  onProblemAttempted: (problemId: number) => void;
}) {
  const navigate = useNavigate();
  const initialCode = '';
  const [code, setCode] = useState(initialCode);
  const [customInput, setCustomInput] = useState(problem.exampleInput || '');
  const [output, setOutput] = useState('');
  const [compilerError, setCompilerError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'compiler'>('input');
  const [activeQuestionTab, setActiveQuestionTab] = useState<'description' | 'examples' | 'constraints'>('description');

  // AI Evaluation State
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResponse | null>(null);
  const [submittedCode, setSubmittedCode] = useState('');
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const submitInFlightRef = useRef(false);
  const feedbackInFlightRef = useRef(false);

  // RUN Flow: Only compiles & executes student code against custom input. Does NOT call Gemini.
  const handleRun = async () => {
    if (!code.trim()) {
      setCompilerError('Editor is empty. Please write your Java code first.');
      setOutput('');
      setActiveTab('compiler');
      return;
    }

    setIsRunning(true);
    setCompilerError('');
    setOutput('');

    let response: Response;

    try {
      response = await fetch(apiUrl('/api/run'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          input: customInput,
        }),
      });
    } catch {
      setCompilerError(
        'Execution server is unavailable.\n\nEnsure the CodeAssess Java backend is running on port 8000.'
      );
      setOutput('');
      setActiveTab('compiler');
      setIsRunning(false);
      return;
    }

    try {
      if (!response.ok) {
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          setCompilerError(
            `Java backend service is currently unreachable (HTTP ${response.status} Bad Gateway).\n\nPlease ensure the backend server is running on port 8000.`
          );
          setActiveTab('compiler');
          return;
        }

        const responseText = await response.text();
        setCompilerError(
          responseText || `Execution server returned HTTP ${response.status}.`
        );
        setActiveTab('compiler');
        return;
      }

      const result: {
        success: boolean;
        stage: 'compile' | 'runtime' | 'completed';
        output: string;
        error: string;
      } = await response.json();

      if (result.success) {
        const out = result.output ? result.output : 'Program finished with no output.';
        setOutput(out);
        setCompilerError('');
        setActiveTab('output');
      } else {
        if (result.stage === 'compile') {
          setCompilerError(result.error || 'Compilation failed.');
          setOutput('');
          setActiveTab('compiler');
        } else {
          // Runtime error or timeout
          setCompilerError(result.error || 'Runtime error occurred.');
          setOutput(result.output || '');
          setActiveTab('compiler');
        }
      }
    } catch {
      setCompilerError('Execution server returned an invalid response.');
      setOutput('');
      setActiveTab('compiler');
    } finally {
      setIsRunning(false);
    }
  };

  const handleFeedback = async (submission: SubmissionResponse, codeForFeedback: string) => {
    if (feedbackInFlightRef.current) return;
    feedbackInFlightRef.current = true;
    setIsFeedbackLoading(true);
    setFeedbackError(null);

    try {
      const response = await fetch(apiUrl('/api/evaluate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          submissionId: submission.submissionId,
          question: {
            title: problem.title,
            description: problem.description,
            inputFormat: problem.input,
            outputFormat: problem.output,
            constraints: problem.constraints,
          },
          code: codeForFeedback,
          execution: submission.execution,
          testCases: submission.testCases,
        }),
      });

      if (!response.ok) {
        let detail = `Gemini feedback failed (HTTP ${response.status}).`;
        try {
          const errorBody = await response.json();
          detail = errorBody.detail || detail;
        } catch {
          // Keep the HTTP status message when the server response is not JSON.
        }
        throw new Error(detail);
      }

      const responseData: unknown = await response.json();
      if (!isEvaluationResult(responseData)) {
        throw new Error(
          'Gemini returned incomplete detailed feedback. Your Java test results are preserved; retry AI feedback.'
        );
      }
      const evaluationData = responseData;
      setEvaluationResult(evaluationData);
      if (evaluationData.totalScore >= 70 && submission.verdict !== 'accepted') {
        onProblemAttempted(problem.id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'Gemini feedback timed out. Your Java test results are saved; retry AI feedback without rerunning tests.'
        : error instanceof Error
          ? error.message
          : 'Gemini feedback could not be generated. Your Java test results are saved.';
      setFeedbackError(message);
    } finally {
      feedbackInFlightRef.current = false;
      setIsFeedbackLoading(false);
    }
  };

  // Java execution returns the authoritative verdict before Gemini feedback is requested.
  const handleSubmit = async () => {
    if (submitInFlightRef.current) return;
    if (!code.trim()) {
      setCompilerError('Editor is empty. Please write your Java code before submitting.');
      setOutput('');
      setActiveTab('compiler');
      return;
    }

    submitInFlightRef.current = true;
    const codeAtSubmission = code;
    setIsSubmitting(true);
    setEvaluationError(null);
    setFeedbackError(null);
    setSubmissionResult(null);
    setEvaluationResult(null);
    setIsEvaluationOpen(false);
    setSubmitStep('Compiling Java solution and testing inputs...');

    const testCaseCount = problem.testCaseCount ?? problem.testCases.length;

    try {
      const submissionResponse = await fetch(apiUrl('/api/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(javaSubmissionTimeoutMs(testCaseCount)),
        body: JSON.stringify({
          problemId: problem.id,
          question: {
            title: problem.title,
            description: problem.description,
            inputFormat: problem.input,
            outputFormat: problem.output,
            constraints: problem.constraints,
          },
          code: codeAtSubmission,
        }),
      });

      if (!submissionResponse.ok) {
        let errorDetail = `Java test evaluation failed (HTTP ${submissionResponse.status}).`;
        try {
          const errJson = await submissionResponse.json();
          errorDetail = errJson.detail || errJson.message || errorDetail;
        } catch {
          const rawText = await submissionResponse.text();
          if (rawText) errorDetail = rawText;
        }
        throw new Error(errorDetail);
      }

      const submission: SubmissionResponse = await submissionResponse.json();
      setSubmissionResult(submission);
      setSubmittedCode(codeAtSubmission);
      setIsEvaluationOpen(true);
      if (submission.verdict === 'accepted') {
        onProblemAttempted(problem.id);
      }
      setIsSubmitting(false);
      await handleFeedback(submission, codeAtSubmission);
    } catch (err: unknown) {
      const message = err instanceof Error && err.name === 'TimeoutError'
        ? 'Java test execution timed out before the backend returned a verdict.'
        : err instanceof Error
          ? err.message
          : 'An unknown error occurred during Java test execution.';
      setEvaluationError(message);
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
      submitInFlightRef.current = false;
    }
  };

  const handleReset = () => {
    setCode(initialCode);
    setOutput('');
    setCompilerError('');
    setActiveTab('input');
  };

  return (
    <div className="app-shell">
      {/* Subtle ambient light */}
      <div className="ambient-glow glow-top" aria-hidden="true" />

      <Navbar />

      <main className="coding-page">
        {/* Coding Header */}
        <section className="page-head coding-head">
          <div className="coding-header-meta">
            <span
              className="section-kicker appear appear--soft"
              style={{ '--d': '0.1s' } as React.CSSProperties}
            >
              Problem #{String(problem.number).padStart(2, '0')} • {problem.topic}
            </span>
            <h1
              className="coding-problem-title appear appear--mask"
              style={{ '--d': '0.2s' } as React.CSSProperties}
            >
              {problem.title}
            </h1>
          </div>

          <div
            className="appear appear--scale"
            style={{ '--d': '0.3s' } as React.CSSProperties}
          >
            <button
              type="button"
              className="btn btn-ghost back-to-list"
              onClick={() => navigate('/assessment')}
            >
              <svg viewBox="0 0 24 24" className="btn-back-icon" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Back to Problems</span>
            </button>
          </div>
        </section>

        {/* 2-Column Coding Layout */}
        <section className="coding-layout">
          {/* Left Column: Problem Information */}
          <aside
            className="question-panel appear appear--soft"
            style={{ '--d': '0.35s' } as React.CSSProperties}
          >
            <div className="question-card-heading">
              <div>
                <span className="problem-title-main">{problem.title}</span>
                <div className="meta-row">
                  <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>
                    <span className="badge-dot"></span>
                    {problem.difficulty}
                  </span>
                  <span className="meta-divider">•</span>
                  <span className="marks-line">Max Marks: {problem.marks}</span>
                </div>
              </div>
            </div>

            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeQuestionTab === 'description' ? 'active' : ''}`}
                onClick={() => setActiveQuestionTab('description')}
              >
                Description
              </button>
              <button
                type="button"
                className={`tab ${activeQuestionTab === 'examples' ? 'active' : ''}`}
                onClick={() => setActiveQuestionTab('examples')}
              >
                Examples
              </button>
              <button
                type="button"
                className={`tab ${activeQuestionTab === 'constraints' ? 'active' : ''}`}
                onClick={() => setActiveQuestionTab('constraints')}
              >
                Constraints
              </button>
            </div>

            <div className="question-scroll">
              {activeQuestionTab === 'description' && (
                <>
                  <div className="description-block">
                    <div className="question-section-label">Description</div>
                    <p>{problem.description}</p>
                  </div>

                  <div className="description-block">
                    <div className="question-section-label">Input Format</div>
                    <pre>{problem.input}</pre>
                  </div>

                  <div className="description-block">
                    <div className="question-section-label">Output Format</div>
                    <pre>{problem.output}</pre>
                  </div>
                </>
              )}

              {activeQuestionTab === 'examples' && (
                <>
                  <div className="description-block">
                    <div className="question-section-label">Example Input</div>
                    <pre>{problem.exampleInput}</pre>
                  </div>

                  <div className="description-block">
                    <div className="question-section-label">Example Output</div>
                    <pre>{problem.exampleOutput}</pre>
                  </div>

                  {problem.testCases && problem.testCases.length > 0 && (
                    <div className="description-block">
                      <div className="question-section-label">Sample Test Cases ({problem.testCases.length})</div>
                      {problem.testCases.map((tc, idx) => (
                        <div key={idx} className="sample-tc-item">
                          <div className="mini-label">Case #{idx + 1}</div>
                          <div className="tc-grid">
                            <div>
                              <span className="tc-sublabel">Input:</span>
                              <pre>{tc.input}</pre>
                            </div>
                            <div>
                              <span className="tc-sublabel">Expected Output:</span>
                              <pre>{tc.expected}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeQuestionTab === 'constraints' && (
                <div className="description-block">
                  <div className="question-section-label">Constraints</div>
                  <pre>{problem.constraints}</pre>
                </div>
              )}
            </div>
          </aside>

          {/* Right Column: Monaco Code Editor + Custom Input / Output / Compiler Tabs */}
          <section
            className="editor-panel appear appear--soft"
            style={{ '--d': '0.45s' } as React.CSSProperties}
          >
            <CodeEditor
              problem={problem}
              code={code}
              onChangeCode={setCode}
              onRun={handleRun}
              onSubmit={handleSubmit}
              onReset={handleReset}
              isRunning={isRunning}
              isSubmitting={isSubmitting || isFeedbackLoading}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              customInput={customInput}
              onCustomInputChange={setCustomInput}
              output={output}
              compilerError={compilerError}
            />
          </section>
        </section>
      </main>

      {/* Submitting Liquid Glass Loading Modal */}
      {isSubmitting && (
        <div className="modal-backdrop submission-backdrop" role="status" aria-live="polite">
          <div className="submission-loading-card appear appear--pop">
            <div className="loading-spinner-ring">
              <div className="spinner-core" />
            </div>
            <h3 className="submitting-title">Evaluating Submission</h3>
            <p className="submitting-status">{submitStep}</p>
            <div className="submitting-subtext">
              Executing JDK subprocess & Google Gemini assessment...
            </div>
          </div>
        </div>
      )}

      {/* Submission Error Dialog */}
      {evaluationError && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="confirm-dialog appear appear--pop">
            <h3 className="dialog-title" style={{ color: '#fca5a5' }}>
              Submission Evaluation Failed
            </h3>
            <p className="dialog-message" style={{ whiteSpace: 'pre-line' }}>
              {evaluationError}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-btn dialog-cancel"
                onClick={() => setEvaluationError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Structured Gemini AI Assessment Result Modal */}
      <EvaluationPanel
        visible={isEvaluationOpen}
        evaluation={evaluationResult}
        verdict={submissionResult}
        isFeedbackLoading={isFeedbackLoading}
        feedbackError={feedbackError}
        onRetryFeedback={() => {
          if (submissionResult) void handleFeedback(submissionResult, submittedCode);
        }}
        code={code}
        problemTitle={problem.title}
        onClose={() => setIsEvaluationOpen(false)}
        onBack={() => {
          setIsEvaluationOpen(false);
          navigate('/assessment');
        }}
      />
    </div>
  );
}
