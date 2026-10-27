import Editor, { type OnMount } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import GlassButton from './GlassButton';
import type { Problem } from '../types/problem';

interface CodeEditorProps {
  problem: Problem;
  code: string;
  onChangeCode: (code: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  onReset: () => void;
  isRunning: boolean;
  isSubmitting: boolean;
  activeTab: 'input' | 'output' | 'compiler';
  onTabChange: (tab: 'input' | 'output' | 'compiler') => void;
  customInput: string;
  onCustomInputChange: (val: string) => void;
  output: string;
  compilerError: string;
}

export default function CodeEditor({
  code,
  onChangeCode,
  onRun,
  onSubmit,
  onReset,
  isRunning,
  isSubmitting,
  activeTab,
  onTabChange,
  customInput,
  onCustomInputChange,
  output,
  compilerError,
}: CodeEditorProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = () => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastVisible(true);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    // Intercept keyboard shortcuts in Monaco
    editor.onKeyDown((event) => {
      const browserEvent = event.browserEvent;
      const key = browserEvent?.key?.toLowerCase();
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd && ['c', 'v', 'x'].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        showToast();
      }
    });

    // Monaco command overrides
    if (monaco) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => showToast());
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => showToast());
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => showToast());
    }

    // Intercept native DOM events on editor container
    const container = editor.getContainerDomNode();
    if (container) {
      const blockHandler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        showToast();
      };

      container.addEventListener('copy', blockHandler, true);
      container.addEventListener('paste', blockHandler, true);
      container.addEventListener('cut', blockHandler, true);
      container.addEventListener('contextmenu', blockHandler, true);
      container.addEventListener('drop', blockHandler, true);
    }
  };

  const handleResetClick = () => {
    if (code.trim().length > 0) {
      setShowResetConfirm(true);
    } else {
      onReset();
    }
  };

  const handleConfirmReset = () => {
    setShowResetConfirm(false);
    onReset();
  };

  return (
    <section className="editor-wrap">
      {/* Editor Topbar */}
      <div className="editor-topbar">
        <div className="language-group">
          <span className="language-label">Language:</span>
          <div className="language-badge">Java</div>
        </div>

        <div className="editor-actions">
          <GlassButton
            variant="secondary"
            size="sm"
            className="editor-action reset"
            onClick={handleResetClick}
            disabled={isRunning || isSubmitting}
          >
            Reset
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            className={`editor-action run ${isRunning ? 'loading' : ''}`}
            onClick={onRun}
            disabled={isRunning || isSubmitting}
            loading={isRunning}
          >
            {isRunning ? 'Running...' : 'Run'}
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            className={`editor-action submit ${isSubmitting ? 'loading' : ''}`}
            onClick={onSubmit}
            disabled={isRunning || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Evaluating...' : 'Submit'}
          </GlassButton>
        </div>
      </div>

      {/* Monaco Editor Canvas */}
      <div className="editor-area">
        <Editor
          height="420px"
          language="java"
          value={code}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(value) => onChangeCode(value ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbersMinChars: 3,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            contextmenu: false,
            selectOnLineNumbers: true,
            glyphMargin: false,
            copyWithSyntaxHighlighting: false,
            readOnly: isRunning || isSubmitting,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            snippetSuggestions: 'inline',
            dragAndDrop: false,
            tabSize: 4,
            fontFamily: 'JetBrains Mono, Consolas, "Courier New", monospace',
            mouseWheelZoom: true,
            padding: { top: 14, bottom: 14 },
          }}
        />
      </div>

      {/* Clean Bottom Tabbed Panel */}
      <div className="bottom-panel">
        <div className="bottom-tabs">
          <button
            type="button"
            className={`bottom-tab ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => onTabChange('input')}
          >
            CUSTOM INPUT
          </button>
          <button
            type="button"
            className={`bottom-tab ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => onTabChange('output')}
          >
            OUTPUT
          </button>
          <button
            type="button"
            className={`bottom-tab ${activeTab === 'compiler' ? 'active' : ''}`}
            onClick={() => onTabChange('compiler')}
          >
            COMPILER {compilerError ? '●' : ''}
          </button>
        </div>

        <div className="bottom-content">
          {activeTab === 'input' && (
            <div className="tab-pane custom-input-pane">
              <label className="pane-label" htmlFor="custom-input-field">
                Standard Input (stdin):
              </label>
              <textarea
                id="custom-input-field"
                className="custom-input-textarea"
                placeholder="Enter input values here (passed to System.in)..."
                value={customInput}
                onChange={(e) => onCustomInputChange(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {activeTab === 'output' && (
            <div className="tab-pane output-pane">
              <div className="pane-header">
                <span className="pane-label">Standard Output (stdout):</span>
              </div>
              <pre className="terminal-output">
                {output ? output : <span className="text-muted-output">Run your code to see the output.</span>}
              </pre>
            </div>
          )}

          {activeTab === 'compiler' && (
            <div className="tab-pane compiler-pane">
              <div className="pane-header">
                <span className="pane-label">Compiler & Runtime Diagnostics:</span>
              </div>
              <pre className={`terminal-output ${compilerError ? 'error-log' : ''}`}>
                {compilerError ? compilerError : <span className="text-muted-output">No compilation or runtime errors.</span>}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Copy / Paste Disabled Toast */}
      {toastVisible && (
        <div className="copy-toast" role="alert">
          <span className="toast-icon">⚠️</span>
          <span>Copy, cut and paste are disabled during assessment.</span>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-backdrop">
          <div className="confirm-dialog" role="dialog" aria-labelledby="reset-dialog-title">
            <h3 id="reset-dialog-title" className="dialog-title">Clear all code?</h3>
            <p className="dialog-message">
              This will remove all code currently written in the editor and reset execution output.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="dialog-btn dialog-cancel"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dialog-btn dialog-clear"
                onClick={handleConfirmReset}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
