import { useEffect, useRef, useCallback } from "react";
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
    sendInput,
  } = execution;

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writtenSeqRef = useRef(0);
  const onDataDisposableRef = useRef<{ dispose: () => void } | null>(null);
  // Live refs so the permanent onData listener always has current values
  const isRunningRef = useRef(isRunning);
  const sendInputRef = useRef(sendInput);
  // chunks that arrived before xterm was ready to accept them
  const pendingChunksRef = useRef(outputChunks);

  // Keep live refs in sync
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { sendInputRef.current = sendInput; }, [sendInput]);

  // keep pendingChunksRef current so initXterm can flush them
  useEffect(() => {
    pendingChunksRef.current = outputChunks;
  });

  // ─── Initialize xterm (deferred until container has real dimensions) ───
  const initXterm = useCallback(() => {
    const el = containerRef.current;
    if (!el || xtermRef.current) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const css = (variable: string, fallback: string) =>
      rootStyles.getPropertyValue(variable).trim() || fallback;

    const bgPrimary = css("--color-bg-primary", "#0d0d0d");
    const textPrimary = css("--color-text-primary", "#e4e4e7");

    const terminal = new XTerm({
      theme: {
        background: bgPrimary,
        foreground: textPrimary,
        cursor: "#4ade80",          // visible green cursor
        cursorAccent: bgPrimary,
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
      convertEol: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(el);
    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // Ignore WebGL fallback errors.
    }

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    writtenSeqRef.current = 0;

    requestAnimationFrame(() => fitAddon.fit());

    // Single permanent onData listener with local echo.
    // Docker exec runs without a TTY so the program never echoes stdin back —
    // we echo keystrokes directly into xterm so the user sees what they type.
    onDataDisposableRef.current = terminal.onData((data) => {
      if (!isRunningRef.current) return;

      if (data === '\r') {
        // Enter: echo a newline, send \n to program
        terminal.write('\r\n');
        sendInputRef.current('\n');
      } else if (data === '\x7f') {
        // Backspace: erase the previous character visually
        terminal.write('\b \b');
        sendInputRef.current(data);
      } else if (data.charCodeAt(0) >= 32) {
        // Printable character: echo it, send it
        terminal.write(data);
        sendInputRef.current(data);
      } else {
        // Control chars (Ctrl+C, Ctrl+D, etc.) — send without echo
        sendInputRef.current(data);
      }
    });

    // Flush any chunks that arrived before the terminal was ready
    for (const chunk of pendingChunksRef.current) {
      const normalized = chunk.data.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
      terminal.write(normalized);
      writtenSeqRef.current = chunk.seq;
    }

    // If execution is already running when xterm finally inits, focus immediately
    if (isRunningRef.current) {
      terminal.options.cursorBlink = true;
      terminal.options.cursorStyle = "block";
      requestAnimationFrame(() => terminal.focus());
    }
  }, []);

  // Wait for the container div to get real dimensions, then init xterm
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (el.clientWidth > 0 && el.clientHeight > 0) {
      initXterm();
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          observer.disconnect();
          initXterm();
          return;
        }
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      xtermRef.current?.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus terminal and update cursor when execution starts/stops
  useEffect(() => {
    const terminal = xtermRef.current;
    if (!terminal) return;
    if (isRunning) {
      terminal.options.cursorBlink = true;
      terminal.options.cursorStyle = "block";
      terminal.focus();
    } else {
      terminal.options.cursorBlink = false;
      terminal.options.cursorStyle = "underline";
    }
  }, [isRunning]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Write new output chunks to xterm ─────────────────────────────────
  useEffect(() => {
    if (!xtermRef.current) return;
    const newChunks = outputChunks.filter((c) => c.seq > writtenSeqRef.current);
    for (const chunk of newChunks) {
      // Normalize line endings: replace any \r\n or bare \n with \r\n
      const normalized = chunk.data.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
      xtermRef.current.write(normalized);
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
          {errorMessage ?? "Error"}
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

      {/* xterm Output */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-bg-primary"
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
}
