import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiUrl } from '../api';
import CodeEditor from '../components/CodeEditor';
import EvaluationPanel from '../components/EvaluationPanel';
import Navbar from '../components/Navbar';
import { mockProblems } from '../data/mockProblems';
import type { EvaluationResult, Problem, TestCaseExecutionResult } from '../types/problem';

export default function CodingPage({
  onProblemAttempted,
}: {
  onProblemAttempted: (problemId: number) => void;
}) {
  const { id } = useParams();

  const problem = useMemo(() => {
    return mockProblems.find((item) => String(item.id) === id) ?? mockProblems[0];
  }, [id]);

  return (
    <CodingWorkspace
      key={problem.id}
      problem={problem}
      onProblemAttempted={onProblemAttempted}
    />
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
  const [code, setCode] = useState('');
  const [customInput, setCustomInput] = useState(problem.exampleInput || '');
  const [output, setOutput] = useState('');
  const [compilerError, setCompilerError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'compiler'>('input');
  const [activeQuestionTab, setActiveQuestionTab] = useState<'description' | 'examples' | 'constraints'>('description');

  // AI Evaluation State
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

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
        'Execution server is unavailable.\n\nStart the CodeAssess Java backend on port 8000.'
      );
      setOutput('');
      setActiveTab('compiler');
      setIsRunning(false);
      return;
    }

    try {
      if (!response.ok) {
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

  // SUBMIT Flow: Compiles, runs test cases against Java backend, sends authoritative results to Gemini API, and displays modal
  const handleSubmit = async () => {
    if (!code.trim()) {
      setCompilerError('Editor is empty. Please write your Java code before submitting.');
      setOutput('');
      setActiveTab('compiler');
      return;
    }

    setIsSubmitting(true);
    setEvaluationError(null);
    setSubmitStep('Compiling Java solution and testing inputs...');

    const testCasesToRun = problem.testCases && problem.testCases.length > 0
      ? problem.testCases
      : [{ input: problem.exampleInput || '', expected: problem.exampleOutput || '' }];

    const executionResults: TestCaseExecutionResult[] = [];
    let overallStatus: 'success' | 'compile_error' | 'runtime_error' | 'timeout' = 'success';
    let mainStdout = '';
    let mainStderr = '';
    let mainCompileError = '';
    const startTime = performance.now();

    try {
      // Step 1: Run through all problem test cases on Java execution backend
      for (let i = 0; i < testCasesToRun.length; i++) {
        const tc = testCasesToRun[i];
        setSubmitStep(`Running Test Case ${i + 1} of ${testCasesToRun.length}...`);

        let runRes: Response;
        try {
          runRes = await fetch(apiUrl('/api/run'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code,
              input: tc.input,
            }),
          });
        } catch {
          throw new Error('Java execution server is unavailable. Ensure the backend is running on port 8000.');
        }

        if (!runRes.ok) {
          const text = await runRes.text();
          throw new Error(`Java backend returned error ${runRes.status}: ${text}`);
        }

        const runData: {
          success: boolean;
          stage: 'compile' | 'runtime' | 'completed';
          output: string;
          error: string;
        } = await runRes.json();

        if (!runData.success && runData.stage === 'compile') {
          // Compilation failed
          overallStatus = 'compile_error';
          mainCompileError = runData.error || 'Compilation failed';
          mainStderr = runData.error || '';

          // Add all remaining test cases as failed due to compilation error
          for (let j = i; j < testCasesToRun.length; j++) {
            executionResults.push({
              input: testCasesToRun[j].input,
              expectedOutput: testCasesToRun[j].expected,
              actualOutput: 'Compilation Error',
              passed: false,
            });
          }
          break; // Stop running remaining tests if code doesn't compile
        }

        if (!runData.success && runData.stage === 'runtime') {
          // Runtime error or timeout
          if (overallStatus === 'success') {
            overallStatus = runData.error.includes('Time Limit Exceeded') ? 'timeout' : 'runtime_error';
          }
          if (!mainStderr) mainStderr = runData.error;

          executionResults.push({
            input: tc.input,
            expectedOutput: tc.expected,
            actualOutput: runData.output || runData.error,
            passed: false,
          });
          continue;
        }

        // Successfully executed
        const actualTrimmed = (runData.output || '').trim();
        const expectedTrimmed = tc.expected.trim();
        const passed = actualTrimmed === expectedTrimmed;

        if (!mainStdout && runData.output) {
          mainStdout = runData.output;
        }

        executionResults.push({
          input: tc.input,
          expectedOutput: tc.expected,
          actualOutput: runData.output,
          passed,
        });
      }

      const totalExecutionTimeMs = Math.round(performance.now() - startTime);

      // Step 2: Send authoritative evidence to Gemini AI Evaluator
      setSubmitStep('Analyzing code and generating AI assessment with Gemini...');

      const evaluatePayload = {
        question: {
          title: problem.title,
          description: problem.description,
          inputFormat: problem.input,
          outputFormat: problem.output,
          constraints: problem.constraints,
        },
        code: code,
        execution: {
          status: overallStatus,
          stdout: mainStdout,
          stderr: mainStderr,
          compileError: mainCompileError,
          executionTimeMs: totalExecutionTimeMs,
        },
        testCases: executionResults,
      };

      const evalRes = await fetch(apiUrl('/api/evaluate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(evaluatePayload),
      });

      if (!evalRes.ok) {
        let errorDetail = 'AI Evaluation request failed.';
        try {
          const errJson = await evalRes.json();
          errorDetail = errJson.detail || errJson.message || errorDetail;
        } catch {
          const rawText = await evalRes.text();
          if (rawText) errorDetail = rawText;
        }
        throw new Error(errorDetail);
      }

      const evaluationData: EvaluationResult = await evalRes.json();
      setEvaluationResult(evaluationData);
      setIsEvaluationOpen(true);

      // Update problem status locally if all tests passed
      if (evaluationData.totalScore >= 70) {
        onProblemAttempted(problem.id);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred during submission.';
      setEvaluationError(message);
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  const handleReset = () => {
    setCode('');
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
              isSubmitting={isSubmitting}
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
