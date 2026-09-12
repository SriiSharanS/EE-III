import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CodeEditor from '../components/CodeEditor';
import EvaluationPanel from '../components/EvaluationPanel';
import Navbar from '../components/Navbar';
import ReviewPanel from '../components/ReviewPanel';
import { mockProblems } from '../data/mockProblems';
import type { Language } from '../types/problem';

export default function CodingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const problem = useMemo(() => {
    return mockProblems.find((item) => String(item.id) === id) ?? mockProblems[0];
  }, [id]);

  const [language, setLanguage] = useState<Language>('Python');
  const [testCaseIndex, setTestCaseIndex] = useState(0);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const runCode = () => {
    console.log('Mock run result:', problem.testCases[testCaseIndex].input);
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="coding-page">
        <section className="page-head coding-head">
          <div>
            <span className="section-kicker">Assessment / Problem {problem.number}</span>
            <h1>{problem.title}</h1>
          </div>
          <button className="back-to-list" onClick={() => navigate('/assessment')}>Back to Problems</button>
        </section>

        <section className="coding-layout">
          <aside className="question-panel">
            <div className="question-card-heading">
              <div>
                <span className="problem-title-main">{problem.title}</span>
                <div className="meta-row">
                  <span className={`difficulty-badge difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
                  <span className="meta-divider">•</span>
                  <span className="marks-line">Max Marks: {problem.marks}</span>
                </div>
              </div>
            </div>

            <div className="tabs">
              <span className="tab active">Description</span>
              <span className="tab">Examples</span>
              <span className="tab">Constraints</span>
            </div>

            <div className="question-scroll">
              <div className="description-block">
                <div className="question-section-label">Description</div>
                <p>{problem.description}</p>
              </div>

              <div className="description-block">
                <div className="question-section-label">Input</div>
                <pre>{problem.input}</pre>
              </div>

              <div className="description-block">
                <div className="question-section-label">Output</div>
                <pre>{problem.output}</pre>
              </div>

              <div className="description-block">
                <div className="question-section-label">Example Input</div>
                <pre>{problem.exampleInput}</pre>
              </div>

              <div className="description-block">
                <div className="question-section-label">Example Output</div>
                <pre>{problem.exampleOutput}</pre>
              </div>

              <div className="description-block">
                <div className="question-section-label">Constraints</div>
                <pre>{problem.constraints}</pre>
              </div>
            </div>
          </aside>

          <section className="editor-panel">
            <CodeEditor
              problem={problem}
              language={language}
              onRun={runCode}
              onSubmit={() => setShowEvaluation(true)}
              onLanguageChange={(value) => setLanguage(value)}
            />
          </section>
        </section>

        <section className="bottom-case-panel">
          <div className="cases-toolbar">
            <button className="testcase-button selected" onClick={() => setTestCaseIndex(0)}>Test Case 1</button>
            <button className="testcase-button" onClick={() => setTestCaseIndex(1)}>Test Case 2</button>
          </div>
          <div className="case-detail">
            <div>
              <span className="mini-label">Input:</span>
              <pre>{problem.testCases[testCaseIndex].input}</pre>
            </div>
            <div>
              <span className="mini-label">Expected:</span>
              <pre>{problem.testCases[testCaseIndex].expected}</pre>
            </div>
          </div>
        </section>

        <section className="lower-output-panel">
          <div className="output-panel-title">Output</div>
          <div className="mock-output">
            <span>Run your code to see the output.</span>
          </div>
        </section>

        <ReviewPanel visible={showReview} />
      </main>

      <EvaluationPanel
        visible={showEvaluation}
        onReview={() => {
          setShowEvaluation(false);
          setShowReview(true);
        }}
        onBack={() => {
          setShowEvaluation(false);
          navigate('/assessment');
        }}
      />
    </div>
  );
}
