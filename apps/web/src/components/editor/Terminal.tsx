import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import {
  ChevronUp,
  X,
  TerminalSquare,
  Loader2,
  AlertCircle,
  WifiOff,
} from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";
import { useTerminalSocket } from "../../hooks/useTerminalSocket";

interface TerminalProps {
  projectId: string;
  userId: string;
  containerStatus: string;
}

type TerminalStatus = "connecting" | "ready" | "error" | "exited";

export function Terminal({
  projectId,
  userId,
  containerStatus,
}: TerminalProps) {
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const toggleTerminal = useEditorStore((s) => s.toggleTerminal);

  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const { sendInput, sendResize } = useTerminalSocket({
    projectId,
    userId,
    enabled: containerStatus === "ready",
    onOutput: (data) => {
      xtermRef.current?.write(data);
    },
    onReady: () => {
      setStatus("ready");
      // Perform an initial fit once ready so the shell gets the right dimensions
      setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const term = xtermRef.current;
          if (term) sendResize(term.rows, term.cols);
        }
      }, 50);
    },
    onError: (message) => {
      setStatus("error");
      setErrorMsg(message);
    },
    onExit: () => {
      setStatus("exited");
      xtermRef.current?.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
    },
  });

  // Mount xterm when terminal opens
  useEffect(() => {
    if (!isTerminalOpen || !containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#1a1a24",
        foreground: "#d4d4d8",
        cursor: "#4ade80",
        cursorAccent: "#1a1a24",
        selectionBackground: "#6366f1",
        black: "#18181b",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#facc15",
        blue: "#818cf8",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#d4d4d8",
        brightBlack: "#52525b",
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
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn(
        "WebGL addon failed to load, falling back to canvas/dom renderer",
        e,
      );
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // Wire user keystrokes → socket
    term.onData((data) => {
      sendInput(data);
    });

    // Wire resize → socket
    term.onResize(({ rows, cols }) => {
      sendResize(rows, cols);
    });

    // ResizeObserver for container size changes
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    observer.observe(containerRef.current);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTerminalOpen]);

  const statusLabel = {
    connecting: "Connecting…",
    ready: "Connected",
    error: "Error",
    exited: "Exited",
  }[status];

  const statusDot = {
    connecting: "bg-yellow-400 animate-pulse",
    ready: "bg-green-400",
    error: "bg-red-400",
    exited: "bg-text-tertiary",
  }[status];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-primary">
      {/* Terminal header */}
      <div
        className="flex items-center justify-between px-3 h-8 bg-bg-secondary shrink-0 select-none cursor-pointer hover:bg-bg-tertiary transition-colors"
        onClick={toggleTerminal}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
          <TerminalSquare size={13} />
          <span>Terminal</span>
          {/* Status badge */}
          <span className="flex items-center gap-1 ml-1 normal-case tracking-normal font-normal text-text-tertiary">
            <span
              className={`w-[6px] h-[6px] rounded-full shrink-0 ${statusDot}`}
            />
            <span>{statusLabel}</span>
          </span>
        </div>
        <button
          className="flex items-center justify-center w-5 h-5 rounded border-none bg-transparent text-text-tertiary hover:bg-white/10 hover:text-text-primary transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            toggleTerminal();
          }}
        >
          {isTerminalOpen ? <X size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Terminal body */}
      {isTerminalOpen && (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Overlay states — shown on top of (but not replacing) xterm div */}
          {containerStatus !== "ready" ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary text-[13px] z-10 bg-bg-primary">
              <Loader2 size={16} className="animate-spin text-accent-primary" />
              <span>Starting container...</span>
            </div>
          ) : status === "connecting" ? (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary text-[13px] z-10 bg-bg-primary">
              <Loader2 size={16} className="animate-spin text-accent-primary" />
              <span>Connecting to terminal...</span>
            </div>
          ) : status === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] z-10 bg-bg-primary">
              <AlertCircle size={20} className="text-red-400" />
              <span className="text-red-400 font-medium">Terminal Error</span>
              <span className="text-text-tertiary text-[12px] max-w-xs text-center">
                {errorMsg}
              </span>
            </div>
          ) : status === "exited" ? (
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-2 text-text-tertiary text-[12px] z-10 pointer-events-none">
              <WifiOff size={13} />
              <span>Shell session ended</span>
            </div>
          ) : null}

          {/* xterm container — always mounted so the terminal can write to it */}
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden px-1 pt-1"
            style={{
              visibility:
                containerStatus !== "ready" ||
                status === "connecting" ||
                status === "error"
                  ? "hidden"
                  : "visible",
            }}
          />
        </div>
      )}
    </div>
  );
}
