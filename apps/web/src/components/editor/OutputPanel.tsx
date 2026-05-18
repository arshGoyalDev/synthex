import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import {
  Play,
  Square,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { UseExecutionReturn } from "../../hooks/useExecution";

interface OutputPanelProps {
  execution: UseExecutionReturn;
  runCommand: string | null;
}

export function OutputPanel({ execution, runCommand }: OutputPanelProps) {
  const {
    outputChunks,
    status,
    exitCode,
    durationMs,
    isRunning,
    errorMessage,
    run,
    kill,
    clear,
  } = execution;

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenSeqRef = useRef(0);

  // ─── Initialize xterm ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const css = (variable: string, fallback: string) =>
      rootStyles.getPropertyValue(variable).trim() || fallback;

    const bgPrimary = css("--color-bg-primary", "#0d0d0d");
    const textPrimary = css("--color-text-primary", "#e4e4e7");

    const terminal = new XTerm({
      theme: {
        background: bgPrimary,
        foreground: textPrimary,
        cursor: bgPrimary, // invisible cursor
        selectionBackground: "rgba(22, 163, 74, 0.24)",
        black: "#18181b",
        red: "#ef4444",
        green: "#4ade80",
        yellow: "#eab308",
        blue: "#818cf8",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: textPrimary,
        brightBlack: "#71717a",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde047",
        brightBlue: "#a5b4fc",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f4f4f5",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.57,
      cursorBlink: false,
      cursorStyle: "underline",
      disableStdin: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // Ignore WebGL fallback errors.
    }

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenSeqRef.current = 0;

    requestAnimationFrame(() => fitAddon.fit());

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // ─── Write new output chunks to xterm ─────────────────────────────────
  useEffect(() => {
    if (!xtermRef.current) return;

    const newChunks = outputChunks.filter((c) => c.seq > writtenSeqRef.current);

    for (const chunk of newChunks) {
      xtermRef.current.write(chunk.data);
      writtenSeqRef.current = chunk.seq;
    }
  }, [outputChunks]);

  // ─── Clear xterm when output is cleared ───────────────────────────────
  useEffect(() => {
    if (outputChunks.length === 0 && xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.reset();
      writtenSeqRef.current = 0;
    }
  }, [outputChunks.length]);

  // ─── Status badge ─────────────────────────────────────────────────────
  const StatusBadge = () => {
    if (status === "idle")
      return (
        <span className="flex items-center gap-1 text-xs text-text-tertiary">
          Ready
        </span>
      );
    if (status === "queued" || status === "running")
      return (
        <span className="flex items-center gap-1 text-xs text-yellow-400">
          <Loader2 size={12} className="animate-spin" />
          {status === "queued" ? "Queued" : "Running"}
        </span>
      );
    if (status === "completed")
      return (
        <span className="flex items-center gap-1 text-xs text-green-400">
          <CheckCircle2 size={12} />
          Completed
          {durationMs != null && (
            <span className="text-text-tertiary ml-1">
              ({(durationMs / 1000).toFixed(1)}s)
            </span>
          )}
        </span>
      );
    if (status === "failed")
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <XCircle size={12} />
          Failed (exit {exitCode})
          {durationMs != null && (
            <span className="text-text-tertiary ml-1">
              ({(durationMs / 1000).toFixed(1)}s)
            </span>
          )}
        </span>
      );
    if (status === "timeout")
      return (
        <span className="flex items-center gap-1 text-xs text-orange-400">
          <Clock size={12} />
          Timed out
        </span>
      );
    if (status === "killed")
      return (
        <span className="flex items-center gap-1 text-xs text-text-tertiary">
          <Square size={12} />
          Killed
        </span>
      );
    if (status === "error")
      return (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle size={12} />
        </span>
      );
    return null;
  };

  const handleRun = () => {
    if (!runCommand) return;
    run(runCommand);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-dark-secondary">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Output
          </span>
          <StatusBadge />
        </div>

        <div className="flex items-center gap-1">
          {isRunning ? (
            <button
              className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
              onClick={kill}
              title="Stop execution"
            >
              <Square size={12} />
              <span>Stop</span>
            </button>
          ) : (
            <button
              className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleRun}
              disabled={!runCommand}
              title={
                runCommand ? `Run: ${runCommand}` : "No run command configured"
              }
            >
              <Play size={12} />
              <span>Run</span>
            </button>
          )}

          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            onClick={clear}
            title="Clear output"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="flex-1 flex bg-bg-primary text-red-400 overflow-hidden justify-center items-center px-10">
          <p>{errorMessage}</p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden bg-bg-primary"
        />
      )}
      {/* xterm Output */}
    </div>
  );
}
