interface TestCasePanelProps {
  cases: Array<{ input: string; expected: string }>;
}

export default function TestCasePanel({ cases }: TestCasePanelProps) {
  return (
    <div className="testcase-panel">
      <div className="panel-title">Test Cases</div>
      {cases.map((item, index) => (
        <div className="testcase-card" key={index}>
          <div className="testcase-card-header">Test Case {index + 1}</div>
          <div className="testcase-card-data">
            <div>
              <span className="data-label">Input:</span>
              <pre>{item.input}</pre>
            </div>
            <div>
              <span className="data-label">Expected:</span>
              <pre>{item.expected}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
