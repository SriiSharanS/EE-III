import Editor from '@monaco-editor/react';
import { useState } from 'react';
import type { Language, Problem } from '../types/problem';

interface CodeEditorProps {
  problem: Problem;
  language: Language;
  onRun: () => void;
  onSubmit: () => void;
  onLanguageChange: (language: Language) => void;
}

const mapLanguageToMonaco = (language: Language) => {
  return {
    Python: 'python',
    Java: 'java',
    C: 'c',
    'C++': 'cpp',
  }[language] ?? 'python';
};

export default function CodeEditor({
  problem,
  language,
  onRun,
  onSubmit,
  onLanguageChange,
}: CodeEditorProps) {
  const [code, setCode] = useState(problem.starterCode[language]);
  const [toastVisible, setToastVisible] = useState(false);

  const handleEditorMount = (editor: any) => {
    const showCopyPasteDisabledMessage = () => {
      setToastVisible(true);
      window.setTimeout(() => setToastVisible(false), 1800);
    };

    editor.onContextMenu((event: any) => {
      event.preventDefault?.();
      showCopyPasteDisabledMessage();
    });

    editor.onMouseDown((event: any) => {
      if (event && event.browserEvent && event.browserEvent.button === 2) {
        showCopyPasteDisabledMessage();
      }
    });

    editor.onKeyDown((event: any) => {
      const key = event.key?.toLowerCase();
      const isCopyPasteCut =
        (event.ctrlKey || event.metaKey) && ['c', 'v', 'x'].includes(key);

      if (isCopyPasteCut) {
        event.preventDefault();
        event.stopPropagation();
        showCopyPasteDisabledMessage();
      }
    });
  };

  const handleLanguageChange = (value: Language) => {
    onLanguageChange(value);
    setCode(problem.starterCode[value]);
  };

  return (
    <section className="editor-wrap">
      <div className="editor-topbar">
        <div className="language-group">
          <span className="language-label">Language:</span>
          <select className="language-select" value={language} onChange={(e) => handleLanguageChange(e.target.value as Language)}>
            <option>Python</option>
            <option>Java</option>
            <option>C</option>
            <option>C++</option>
          </select>
        </div>

        <div className="editor-actions">
          <button className="editor-action reset" onClick={() => setCode(problem.starterCode[language])}>Reset</button>
          <button className="editor-action run" onClick={onRun}>Run</button>
          <button className="editor-action submit" onClick={onSubmit}>Submit</button>
        </div>
      </div>

      <div className="editor-area">
        <Editor
          height="380px"
          language={mapLanguageToMonaco(language)}
          value={code}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(value) => setCode(value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 15,
            lineNumbersMinChars: 3,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            contextmenu: false,
            selectOnLineNumbers: true,
            glyphMargin: true,
            copyWithSyntaxHighlighting: false,
            readOnly: false,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            snippetSuggestions: 'inline',
            dragAndDrop: false,
            tabSize: 4,
            fontFamily: 'JetBrains Mono, Consolas, monospace',
            mouseWheelZoom: true,
            padding: { top: 16, bottom: 16 },
          }}
        />
      </div>

      <div className="bottom-panel">
        <div className="bottom-tabs">
          <button className="bottom-tab active">Test Cases</button>
          <button className="bottom-tab">Output</button>
          <button className="bottom-tab">Compiler</button>
          <button className="bottom-tab">Evaluation</button>
        </div>
        <div className="bottom-content">
          <div className="testcase-strip">
            <div className="testcase-tab active">Test Case 1</div>
            <div className="testcase-tab">Test Case 2</div>
          </div>
          <div className="testcase-output">
            <div className="testcase-line">
              <span className="testcase-label">Input:</span>
              <pre>{problem.testCases[0].input}</pre>
            </div>
            <div className="testcase-line">
              <span className="testcase-label">Expected:</span>
              <pre>{problem.testCases[0].expected}</pre>
            </div>
          </div>
          <div className="output-placeholder">Run your code to see the output.</div>
        </div>
      </div>

      {toastVisible && (
        <div className="copy-toast">
          <span>Copy and Paste are disabled during assessment.</span>
        </div>
      )}
    </section>
  );
}
