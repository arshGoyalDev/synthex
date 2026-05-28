import { useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Loader2, Terminal } from "lucide-react";
import type { SetupLogLine, SetupStage } from "../../stores/setup.store";

interface SetupLogPanelProps {
  projectName: string;
  logs: SetupLogLine[];
  stage: SetupStage;
  stageName: string;
  progress: number;
  totalCommands: number;
  currentCommandIndex: number;
  canOpenEditor: boolean;
  error: string | null;
  onOpenEditorEarly: () => void;
  onRetry?: () => void;
}

function LogLine({ line }: { line: SetupLogLine }) {
  if (line.type === "command") {
    return (
      <div className="setup-log-line setup-log-command">
        <span className="setup-log-prompt">$</span>
        <span className="setup-log-text">{line.text.replace(/^\$\s*/, "")}</span>
      </div>
    );
  }

  if (line.type === "success") {
    return (
      <div className="setup-log-line setup-log-success">
        <CheckCircle2 size={12} className="setup-log-icon" />
        <span className="setup-log-text">{line.text}</span>
      </div>
    );
  }

  if (line.type === "error") {
    return (
      <div className="setup-log-line setup-log-error">
        <XCircle size={12} className="setup-log-icon" />
        <span className="setup-log-text">{line.text}</span>
      </div>
    );
  }

  // info — may include stage headers starting with ⟳
  const isStageHeader = line.text.startsWith("⟳");
  return (
    <div className={`setup-log-line ${isStageHeader ? "setup-log-stage-header" : "setup-log-info"}`}>
      {isStageHeader ? (
        <Loader2 size={12} className="setup-log-icon animate-spin" />
      ) : (
        <span className="setup-log-indent" />
      )}
      <span className="setup-log-text">{line.text.replace(/^⟳\s*/, "")}</span>
    </div>
  );
}

export function SetupLogPanel({
  projectName,
  logs,
  stage,
  stageName,
  progress,
  totalCommands,
  currentCommandIndex,
  canOpenEditor,
  error,
  onOpenEditorEarly,
  onRetry,
}: SetupLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Auto-scroll only when user is at the bottom
  useEffect(() => {
    if (isAtBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 60;
  };

  const isDone = stage === "done";
  const isError = stage === "error";
  const isRunning = stage !== "done" && stage !== "error" && stage !== "idle";

  const progressClamped = Math.min(100, Math.max(0, progress));

  const stageLabel =
    isDone ? "Ready" :
    isError ? "Failed" :
    stageName || "Setting up…";

  return (
    <div className="setup-panel">
      {/* Header */}
      <div className="setup-panel-header">
        <div className="setup-panel-header-left">
          <div className={`setup-panel-status-dot ${isDone ? "dot-ready" : isError ? "dot-error" : "dot-running"}`} />
          <div>
            <p className="setup-panel-project-name">{projectName}</p>
            <p className="setup-panel-stage-label">{stageLabel}</p>
          </div>
        </div>

        <div className="setup-panel-actions">
          {canOpenEditor && !isDone && !isError && (
            <button
              id="setup-open-editor-early-btn"
              className="setup-btn-secondary"
              onClick={onOpenEditorEarly}
              title="Open editor now — installation continues in the background"
            >
              Open Editor
            </button>
          )}
          {isError && onRetry && (
            <button
              id="setup-retry-btn"
              className="setup-btn-primary"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="setup-progress-track">
        <div
          className={`setup-progress-fill ${isDone ? "progress-done" : isError ? "progress-error" : ""}`}
          style={{ width: `${progressClamped}%` }}
        />
      </div>

      {/* Step counter */}
      {totalCommands > 0 && (
        <div className="setup-step-counter">
          {isDone ? (
            <span className="step-counter-done">All steps completed</span>
          ) : (
            <span>Step {currentCommandIndex} of {totalCommands}</span>
          )}
        </div>
      )}

      {/* Log window */}
      <div
        ref={scrollRef}
        className="setup-log-scroll"
        onScroll={handleScroll}
      >
        {logs.length === 0 && isRunning && (
          <div className="setup-log-empty">
            <Loader2 size={16} className="animate-spin text-text-tertiary" />
            <span>Starting up…</span>
          </div>
        )}

        {logs.map((line) => (
          <LogLine key={line.seq} line={line} />
        ))}

        {isDone && (
          <div className="setup-log-done-line">
            <CheckCircle2 size={13} />
            <span>Environment ready</span>
          </div>
        )}

        {isError && (
          <div className="setup-log-error-line">
            <XCircle size={13} />
            <span>{error || "Setup failed. See output above for details."}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Footer hint */}
      {isRunning && !canOpenEditor && (
        <div className="setup-panel-footer">
          <Terminal size={12} />
          <span>Building your environment…</span>
        </div>
      )}
    </div>
  );
}
