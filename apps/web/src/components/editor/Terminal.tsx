import { Fragment, useEffect, useRef, useState } from "react";
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
  Plus,
  SplitSquareHorizontal,
} from "lucide-react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { useEditorStore } from "../../stores/editor.store";
import { useTerminalSocket } from "../../hooks/useTerminalSocket";

interface TerminalProps {
  projectId: string;
  userId: string;
  containerStatus: string;
}

type TerminalStatus = "connecting" | "ready" | "error";

interface TerminalSessionProps {
  projectId: string;
  userId: string;
  terminalId: string;
  groupId: string;
  active: boolean;
  autoFocus?: boolean;
  containerStatus: string;
}

function TerminalSession({
  projectId,
  userId,
  terminalId,
  groupId,
  active,
  autoFocus = false,
  containerStatus,
}: TerminalSessionProps) {
  const closeTerminal = useEditorStore((s) => s.closeTerminal);
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [errorMsg, setErrorMsg] = useState("");

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
      requestAnimationFrame(() => {
        if (!fitAddonRef.current || !xtermRef.current) return;
        fitAddonRef.current.fit();
        sendResize(xtermRef.current.rows, xtermRef.current.cols);
      });
    },
    onError: (message) => {
      setStatus("error");
      setErrorMsg(message);
    },
    onExit: () => {
      closeTerminal(terminalId, groupId);
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
      // fallback silently
    }

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    requestAnimationFrame(() => fitAddon.fit());

    term.onData((data) => sendInput(data));
    term.onResize(({ rows, cols }) => sendResize(rows, cols));

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
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
      if (!xtermRef.current) return;
      sendResize(xtermRef.current.rows, xtermRef.current.cols);
      if (autoFocus) xtermRef.current.focus();
    });
  }, [active, autoFocus, sendResize]);

  return (
    <div
      className={`absolute inset-0 ${active ? "block" : "hidden"}`}
      data-terminal-session-id={terminalId}
    >
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
      ) : null}

      <div
        ref={containerRef}
        className="synthex-terminal h-full overflow-hidden"
        onMouseDown={() => xtermRef.current?.focus()}
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

interface TerminalPaneProps {
  projectId: string;
  userId: string;
  containerStatus: string;
  groupId: string;
}

function TerminalPane({
  projectId,
  userId,
  containerStatus,
  groupId,
}: TerminalPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const group = useEditorStore((s) => s.terminalGroups[groupId]);
  const terminalTabs = useEditorStore((s) => s.terminalTabs);
  const setActiveTerminal = useEditorStore((s) => s.setActiveTerminal);
  const closeTerminal = useEditorStore((s) => s.closeTerminal);
  const openNewTerminal = useEditorStore((s) => s.openNewTerminal);
  const moveTerminal = useEditorStore((s) => s.moveTerminal);
  const terminalGrid = useEditorStore((s) => s.terminalGrid);
  const totalTerminalCount = useEditorStore(
    (s) => Object.keys(s.terminalTabs).length,
  );
  const [dragTarget, setDragTarget] = useState<
    "left" | "right" | "center" | null
  >(null);

  if (!group) return null;

  const focusTerminalInput = (terminalId: string) => {
    requestAnimationFrame(() => {
      const selector = `[data-terminal-session-id="${terminalId}"] .xterm-helper-textarea`;
      const textarea = paneRef.current?.querySelector(selector) as
        | HTMLTextAreaElement
        | undefined;
      textarea?.focus();
    });
  };

  useEffect(() => {
    if (!group.activeTerminalId) return;
    focusTerminalInput(group.activeTerminalId);
  }, [group.activeTerminalId, group.terminalIds.join(",")]);

  const getDragPayload = (event: React.DragEvent) => {
    const custom = event.dataTransfer.getData(
      "application/vnd.synthex.terminal",
    );
    if (custom) return custom;
    return event.dataTransfer.getData("text/plain");
  };

  const resolveDropZone = (event: React.DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const threshold = 0.24;

    if (x < rect.width * threshold) return "left" as const;
    if (x > rect.width * (1 - threshold)) return "right" as const;
    return "center" as const;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const payload = getDragPayload(e);
    if (!payload) return;
    e.preventDefault();
    setDragTarget(resolveDropZone(e));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const payload = getDragPayload(e);
    const zone = resolveDropZone(e);
    setDragTarget(null);
    if (!payload) return;

    try {
      const parsed = JSON.parse(payload) as {
        terminalId: string;
        sourceGroupId: string;
      };

      if (!parsed.terminalId || !parsed.sourceGroupId) return;

      if (zone === "left" || zone === "right") {
        if (terminalGrid.length >= 3) {
          moveTerminal(parsed.terminalId, parsed.sourceGroupId, groupId);
          focusTerminalInput(parsed.terminalId);
          return;
        }
        moveTerminal(parsed.terminalId, parsed.sourceGroupId, groupId, zone);
        focusTerminalInput(parsed.terminalId);
        return;
      }

      moveTerminal(parsed.terminalId, parsed.sourceGroupId, groupId);
      focusTerminalInput(parsed.terminalId);
    } catch {
      // noop for malformed payload
    }
  };

  return (
    <div
      ref={paneRef}
      className="h-full flex flex-col overflow-hidden bg-bg-primary relative"
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node | null;
        if (related && e.currentTarget.contains(related)) return;
        setDragTarget(null);
      }}
      onDrop={handleDrop}
    >
      <div className="flex items-stretch h-9 border-b border-border-subtle bg-bg-dark-secondary shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {group.terminalIds.map((terminalId) => {
          const terminal = terminalTabs[terminalId];
          if (!terminal) return null;
          const isActive = group.activeTerminalId === terminalId;

          return (
            <button
              key={terminalId}
              draggable
              onDragStart={(e) => {
                const payload = JSON.stringify({
                  terminalId,
                  sourceGroupId: groupId,
                });
                e.dataTransfer.setData(
                  "application/vnd.synthex.terminal",
                  payload,
                );
                e.dataTransfer.setData("text/plain", payload);
                e.dataTransfer.effectAllowed = "move";
              }}
              className={`group flex items-center gap-1.5 pl-3 pr-1 min-w-[136px] border-r border-border-subtle bg-transparent text-[12px] h-full cursor-pointer transition-colors relative ${
                isActive
                  ? "text-text-primary bg-bg-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
              }`}
              onClick={() => {
                setActiveTerminal(terminalId, groupId);
                focusTerminalInput(terminalId);
              }}
              title={terminal.title}
            >
              <TerminalSquare size={12} />
              <span className="truncate">{terminal.title}</span>
              <span
                className={`flex items-center justify-center w-5 h-5 rounded ml-auto text-text-tertiary transition-all duration-100 hover:bg-white/10 hover:!text-text-primary hover:!opacity-100 ${
                  isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminalId, groupId);
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

        <button
          className="flex items-center justify-center w-8 h-full shrink-0 text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-colors cursor-pointer border-r border-border-subtle"
          onClick={() => openNewTerminal(groupId)}
          title="New terminal in pane"
          disabled={totalTerminalCount >= 6}
        >
          <Plus size={13} />
        </button>
      </div>

      {dragTarget === "left" && terminalGrid.length < 3 && (
        <div className="absolute inset-y-0 left-0 w-1/3 bg-accent-primary/18 border-r border-accent-primary pointer-events-none z-20 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-accent-primary">
            Split Left
          </span>
        </div>
      )}
      {dragTarget === "right" && terminalGrid.length < 3 && (
        <div className="absolute inset-y-0 right-0 w-1/3 bg-accent-primary/18 border-l border-accent-primary pointer-events-none z-20 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-accent-primary">
            Split Right
          </span>
        </div>
      )}
      {dragTarget === "center" && (
        <div className="absolute inset-0 bg-accent-primary/10 pointer-events-none z-20 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-accent-primary">
            Move Here
          </span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {group.terminalIds.map((terminalId) => (
          <TerminalSession
            key={terminalId}
            projectId={projectId}
            userId={userId}
            terminalId={terminalId}
            groupId={groupId}
            active={group.activeTerminalId === terminalId}
            autoFocus={group.activeTerminalId === terminalId}
            containerStatus={containerStatus}
          />
        ))}
      </div>
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
  const openNewTerminal = useEditorStore((s) => s.openNewTerminal);
  const splitTerminalGroup = useEditorStore((s) => s.splitTerminalGroup);
  const terminalGrid = useEditorStore((s) => s.terminalGrid);
  const terminalTabs = useEditorStore((s) => s.terminalTabs);
  const activeTerminalGroupId = useEditorStore((s) => s.activeTerminalGroupId);

  const totalTerminalCount = Object.keys(terminalTabs).length;

  useEffect(() => {
    if (!isTerminalOpen || totalTerminalCount > 0) return;
    openNewTerminal();
  }, [isTerminalOpen, totalTerminalCount, openNewTerminal]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-dark-secondary border-t border-border-subtle">
      <div className="h-10 px-3 border-b border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] font-semibold text-text-secondary">
          <TerminalSquare size={13} />
          <span>Terminal</span>
          <span className="normal-case tracking-normal font-normal text-text-tertiary">
            {totalTerminalCount}/6
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="flex items-center gap-1 px-2 h-7 rounded-md border border-border-subtle bg-bg-secondary text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors text-[11px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Split terminal pane horizontally"
            onClick={() =>
              splitTerminalGroup(activeTerminalGroupId ?? undefined)
            }
            disabled={terminalGrid.length >= 3 || totalTerminalCount >= 6}
          >
            <SplitSquareHorizontal size={13} />
            <span>Split</span>
          </button>

          <button
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border-subtle bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="New Terminal (Ctrl+Shift+/)"
            onClick={() => openNewTerminal()}
            disabled={totalTerminalCount >= 6}
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

      {isTerminalOpen && (
        <PanelGroup
          orientation="horizontal"
          className="flex-1 min-h-0 bg-bg-primary"
        >
          {terminalGrid.map((groupId, idx) => (
            <Fragment key={groupId}>
              <Panel
                minSize={20}
                defaultSize={Math.floor(100 / Math.max(1, terminalGrid.length))}
                className="min-h-0 relative"
              >
                <TerminalPane
                  projectId={projectId}
                  userId={userId}
                  containerStatus={containerStatus}
                  groupId={groupId}
                />
              </Panel>
              {idx < terminalGrid.length - 1 && (
                <PanelResizeHandle className="w-1 shrink-0 bg-border-subtle hover:bg-accent-primary active:bg-accent-primary transition-colors cursor-col-resize z-10 relative" />
              )}
            </Fragment>
          ))}
        </PanelGroup>
      )}
    </div>
  );
}
