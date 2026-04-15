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
  Plus,
  Columns2,
  PanelsTopLeft,
} from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";
import { useTerminalSocket } from "../../hooks/useTerminalSocket";

interface TerminalProps {
  projectId: string;
  userId: string;
  containerStatus: string;
}

type TerminalStatus = "connecting" | "ready" | "error" | "exited";

interface TerminalSessionProps {
  projectId: string;
  userId: string;
  terminalId: string;
  active: boolean;
  containerStatus: string;
}

function TerminalSession({
  projectId,
  userId,
  terminalId,
  active,
  containerStatus,
}: TerminalSessionProps) {
  const closeTerminal = useEditorStore((s) => s.closeTerminal);
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const { sendInput, sendResize } = useTerminalSocket({
    projectId,
    userId,
    terminalId,
    enabled: containerStatus === "ready",
    onOutput: (data) => {
      xtermRef.current?.write(data);
    },
    onReady: () => {
      setStatus("ready");
      setTimeout(() => {
        if (fitAddonRef.current && xtermRef.current) {
          fitAddonRef.current.fit();
          sendResize(xtermRef.current.rows, xtermRef.current.cols);
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
      closeTerminal(terminalId);
    },
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0d0d0d",
        foreground: "#d4d4d8",
        cursor: "#4ade80",
        cursorAccent: "#0d0d0d",
        selectionBackground: "rgba(22, 163, 74, 0.28)",
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
      fontSize: 14,
      lineHeight: 1.57,
      cursorBlink: true,
      cursorStyle: "block",
      allowTransparency: false,
      scrollback: 7000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // ignore webgl fallback
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    term.onData((data) => {
      sendInput(data);
    });

    term.onResize(({ rows, cols }) => {
      sendResize(rows, cols);
    });

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendInput, sendResize]);

  useEffect(() => {
    if (!active || !fitAddonRef.current || !xtermRef.current) return;
    requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      if (xtermRef.current) {
        sendResize(xtermRef.current.rows, xtermRef.current.cols);
      }
    });
  }, [active, sendResize]);

  return (
    <div className={`relative h-full ${active ? "block" : "hidden"}`}>
      {containerStatus !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary text-[13px] z-10 bg-bg-primary/95 backdrop-blur-sm">
          <Loader2 size={16} className="animate-spin text-accent-primary" />
          <span>Starting container...</span>
        </div>
      ) : status === "connecting" ? (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-text-secondary text-[13px] z-10 bg-bg-primary/95 backdrop-blur-sm">
          <Loader2 size={16} className="animate-spin text-accent-primary" />
          <span>Connecting to terminal...</span>
        </div>
      ) : status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] z-10 bg-bg-primary/95 backdrop-blur-sm">
          <AlertCircle size={20} className="text-red-400" />
          <span className="text-red-400 font-medium">Terminal Error</span>
          <span className="text-text-tertiary text-[12px] max-w-xs text-center">
            {errorMsg}
          </span>
        </div>
      ) : status === "exited" ? (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 text-text-tertiary text-[12px] z-10 pointer-events-none">
          <WifiOff size={13} />
          <span>Shell session ended</span>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className="synthex-terminal h-full overflow-hidden rounded-b-xl"
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
  );
}

export function Terminal({
  projectId,
  userId,
  containerStatus,
}: TerminalProps) {
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const toggleTerminal = useEditorStore((s) => s.toggleTerminal);
  const toggleTerminalViewMode = useEditorStore(
    (s) => s.toggleTerminalViewMode,
  );
  const terminalViewMode = useEditorStore((s) => s.terminalViewMode);
  const terminals = useEditorStore((s) => s.terminals);
  const activeTerminalId = useEditorStore((s) => s.activeTerminalId);
  const setActiveTerminal = useEditorStore((s) => s.setActiveTerminal);
  const closeTerminal = useEditorStore((s) => s.closeTerminal);
  const openNewTerminal = useEditorStore((s) => s.openNewTerminal);

  const activeTerminal =
    terminals.find((t) => t.id === activeTerminalId) ?? null;

  useEffect(() => {
    if (!isTerminalOpen || terminals.length > 0) return;
    openNewTerminal();
  }, [isTerminalOpen, terminals.length, openNewTerminal]);

  const splitTerminals = terminals.slice(0, 2);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-dark-secondary border-t border-border-subtle">
      <div className="h-10 px-3 border-b border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] font-semibold text-text-secondary">
          <TerminalSquare size={13} />
          <span>Terminal</span>
          {activeTerminal && terminalViewMode === "tabs" && (
            <span className="normal-case tracking-normal font-normal text-text-tertiary">
              {activeTerminal.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 px-2 h-7 rounded-md border border-border-subtle bg-bg-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors text-[11px] cursor-pointer"
            title={
              terminalViewMode === "split"
                ? "Switch to tabs"
                : "Open split view"
            }
            onClick={toggleTerminalViewMode}
          >
            {terminalViewMode === "split" ? (
              <PanelsTopLeft size={13} />
            ) : (
              <Columns2 size={13} />
            )}
            <span>{terminalViewMode === "split" ? "Tabs" : "Split"}</span>
          </button>

          <button
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border-subtle bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer"
            title="New Terminal (Ctrl+Shift+/)"
            onClick={openNewTerminal}
          >
            <Plus size={14} />
          </button>

          <button
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border-subtle bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer"
            title={
              isTerminalOpen
                ? "Collapse Terminal (Ctrl+J)"
                : "Open Terminal (Ctrl+J)"
            }
            onClick={toggleTerminal}
          >
            {isTerminalOpen ? <X size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {isTerminalOpen && terminalViewMode === "tabs" && (
        <>
          <div className="flex items-stretch h-9 border-b border-border-subtle bg-bg-dark-secondary shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {terminals.map((terminal) => {
              const isActive = terminal.id === activeTerminalId;
              return (
                <button
                  key={terminal.id}
                  className={`group flex items-center gap-1.5 pl-3 pr-1 min-w-[136px] border-r border-border-subtle bg-transparent text-[12px] h-full cursor-pointer transition-colors relative ${
                    isActive
                      ? "text-text-primary bg-bg-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
                  }`}
                  onClick={() => setActiveTerminal(terminal.id)}
                  title={terminal.title}
                >
                  <TerminalSquare size={12} />
                  <span className="truncate">{terminal.title}</span>
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded ml-auto text-text-tertiary transition-all duration-100 hover:bg-white/10 hover:!text-text-primary hover:!opacity-100 ${
                      isActive
                        ? "opacity-60"
                        : "opacity-0 group-hover:opacity-60"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminal(terminal.id);
                    }}
                  >
                    <X size={13} />
                  </span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-t pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 relative overflow-hidden bg-bg-primary">
            {terminals.map((terminal) => (
              <TerminalSession
                key={terminal.id}
                projectId={projectId}
                userId={userId}
                terminalId={terminal.id}
                active={terminal.id === activeTerminalId}
                containerStatus={containerStatus}
              />
            ))}
          </div>
        </>
      )}

      {isTerminalOpen && terminalViewMode === "split" && (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 bg-bg-primary">
          {splitTerminals.map((terminal, idx) => (
            <div
              key={terminal.id}
              className={`min-h-0 relative ${idx === 0 ? "md:border-r border-border-subtle" : ""}`}
            >
              <div className="h-8 px-2 border-b border-border-subtle bg-bg-dark-secondary flex items-center justify-between">
                <button
                  className={`flex items-center gap-1.5 text-[12px] px-1.5 py-0.5 rounded cursor-pointer border-none ${
                    terminal.id === activeTerminalId
                      ? "text-text-primary bg-surface-overlay"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                  onClick={() => setActiveTerminal(terminal.id)}
                >
                  <TerminalSquare size={12} />
                  <span>{terminal.title}</span>
                </button>
                <button
                  className="flex items-center justify-center w-5 h-5 rounded border-none bg-transparent text-text-tertiary hover:bg-surface-overlay hover:text-text-primary transition-colors cursor-pointer"
                  onClick={() => closeTerminal(terminal.id)}
                  title={`Close ${terminal.title}`}
                >
                  <X size={13} />
                </button>
              </div>

              <div className="h-[calc(100%-2rem)] relative">
                <TerminalSession
                  projectId={projectId}
                  userId={userId}
                  terminalId={terminal.id}
                  active
                  containerStatus={containerStatus}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
