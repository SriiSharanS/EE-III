import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiUrl } from '../api';
import CodeEditor from '../components/CodeEditor';
import Navbar from '../components/Navbar';
import { mockProblems } from '../data/mockProblems';
import type { Problem } from '../types/problem';

export default function CodingPage() {
  const { id } = useParams();

  const problem = useMemo(() => {
    return mockProblems.find((item) => String(item.id) === id) ?? mockProblems[0];
  }, [id]);

  return <CodingWorkspace key={problem.id} problem={problem} />;
}

function CodingWorkspace({ problem }: { problem: Problem }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [customInput, setCustomInput] = useState(problem.exampleInput || '');
  const [output, setOutput] = useState('');
  const [compilerError, setCompilerError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'compiler'>('input');
  const [activeQuestionTab, setActiveQuestionTab] = useState<'description' | 'examples' | 'constraints'>('description');

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
                      <div className="question-section-label">Sample Test Cases</div>
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
              onReset={handleReset}
              isRunning={isRunning}
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
    </div>
  );
}
