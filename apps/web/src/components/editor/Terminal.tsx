import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import {
  ChevronUp,
  Plus,
  SplitSquareHorizontal,
  TerminalSquare,
  X,
  Loader2,
  AlertCircle,
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
    onOutput: (data) => xtermRef.current?.write(data),
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
    onExit: () => closeTerminal(terminalId, groupId),
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const css = (variable: string, fallback: string) =>
      rootStyles.getPropertyValue(variable).trim() || fallback;

    const bgPrimary = css("--color-bg-primary", "#0d0d0d");
    const textPrimary = css("--color-text-primary", "#e4e4e7");
    const accentPrimary = css("--color-accent-primary", "#16a34a");

    const terminal = new XTerm({
      theme: {
        background: bgPrimary,
        foreground: textPrimary,
        cursor: accentPrimary,
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
      fontSize: 14,
      lineHeight: 1.57,
      cursorBlink: true,
      cursorStyle: "block",
      drawBoldTextInBrightColors: true,
      allowTransparency: false,
      scrollback: 8000,
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

    requestAnimationFrame(() => fitAddon.fit());

    terminal.onData((data) => sendInput(data));
    terminal.onResize(({ rows, cols }) => sendResize(rows, cols));

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
        <TerminalStateOverlay
          icon={
            <Loader2 size={16} className="animate-spin text-accent-primary" />
          }
          title="Starting container"
          subtitle="Preparing shell runtime"
        />
      ) : status === "connecting" ? (
        <TerminalStateOverlay
          icon={
            <Loader2 size={16} className="animate-spin text-accent-primary" />
          }
          title="Connecting terminal"
          subtitle="Waiting for terminal socket"
        />
      ) : status === "error" ? (
        <TerminalStateOverlay
          icon={<AlertCircle size={18} className="text-red-400" />}
          title="Terminal error"
          subtitle={errorMsg || "Unable to connect this terminal session"}
          danger
        />
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

function TerminalStateOverlay({
  icon,
  title,
  subtitle,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-bg-dark-secondary/80 px-5 py-4">
        {icon}
        <span
          className={`text-sm font-medium ${danger ? "text-red-400" : "text-text-primary"}`}
        >
          {title}
        </span>
        <span className="text-xs text-text-tertiary">{subtitle}</span>
      </div>
    </div>
  );
}

interface TerminalGroupPaneProps {
  projectId: string;
  userId: string;
  containerStatus: string;
  groupId: string;
}

function TerminalGroupPane({
  projectId,
  userId,
  containerStatus,
  groupId,
}: TerminalGroupPaneProps) {
  const paneRef = useRef<HTMLDivElement>(null);
  const group = useEditorStore((s) => s.terminalGroups[groupId]);
  const terminalTabs = useEditorStore((s) => s.terminalTabs);
  const setActiveTerminal = useEditorStore((s) => s.setActiveTerminal);
  const closeTerminal = useEditorStore((s) => s.closeTerminal);
  const openNewTerminal = useEditorStore((s) => s.openNewTerminal);
  const totalTerminalCount = useEditorStore(
    (s) => Object.keys(s.terminalTabs).length,
  );
  const activeTerminalGroupId = useEditorStore((s) => s.activeTerminalGroupId);
  const activeTerminalId = group?.activeTerminalId ?? null;
  const terminalIdsKey = group?.terminalIds.join(",") ?? "";

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
    if (!activeTerminalId) return;
    focusTerminalInput(activeTerminalId);
  }, [activeTerminalId, terminalIdsKey]);

  if (!group) return null;

  return (
    <div
      ref={paneRef}
      className={`relative flex h-full flex-col overflow-hidden bg-bg-primary ${
        activeTerminalGroupId === groupId
          ? "ring-1 ring-inset ring-accent-primary/25"
          : "ring-1 ring-inset ring-transparent"
      }`}
      onClickCapture={() => {
        if (!group.activeTerminalId) return;
        setActiveTerminal(group.activeTerminalId, groupId);
      }}
    >
      <div className="flex shrink-0 items-stretch border-b border-border-subtle bg-bg-dark-secondary">
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {group.terminalIds.map((terminalId) => {
            const terminal = terminalTabs[terminalId];
            if (!terminal) return null;
            const isActive = group.activeTerminalId === terminalId;

            return (
              <button
                key={terminalId}
                className={`group relative flex h-full items-center gap-1 border-r border-border-subtle py-1 pl-3 pr-1 text-xs transition-colors ${
                  isActive
                    ? "bg-bg-primary text-text-primary"
                    : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                }`}
                onClick={() => {
                  setActiveTerminal(terminalId, groupId);
                  focusTerminalInput(terminalId);
                }}
                title={terminal.title}
              >
                <span className="truncate">{terminal.title}</span>
                <span
                  className={`ml-auto flex pb-0.5 h-5 w-5 items-center justify-center rounded text-text-tertiary transition-all hover:bg-white/10 hover:!text-text-primary hover:!opacity-100 ${
                    isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTerminal(terminalId, groupId);
                  }}
                >
                  <X size={13} />
                </span>
                {isActive && (
                  <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-accent-primary" />
                )}
              </button>
            );
          })}
        </div>

        <button
          className="flex h-full w-8 shrink-0 items-center justify-center border-l border-border-subtle text-text-tertiary transition-colors hover:bg-white/[0.03] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => openNewTerminal(groupId)}
          disabled={totalTerminalCount >= 6}
          title="New terminal in this pane"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-bg-primary">
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
  const canCreateMore = totalTerminalCount < 6;
  const canSplit = terminalGrid.length < 2 && canCreateMore;

  useEffect(() => {
    if (!isTerminalOpen || totalTerminalCount > 0) return;
    openNewTerminal();
  }, [isTerminalOpen, totalTerminalCount, openNewTerminal]);

  if (!isTerminalOpen) {
    return (
      <div className="flex h-full items-center justify-between border-t border-border-subtle bg-bg-dark-secondary px-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
          <TerminalSquare size={13} />
          <span className="pt-0.5">Terminal</span>
        </div>
        <button
          className="flex h-6 items-center justify-center gap-1 rounded-md border border-border-subtle bg-bg-secondary px-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          title="Open terminal (Ctrl+J)"
          onClick={toggleTerminal}
        >
          <ChevronUp size={12} />
          <span>Open</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden border-t border-border-subtle bg-bg-dark-secondary">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] pl-3 pr-0.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
          <TerminalSquare size={13} />
          <span>Terminal</span>
          <span className="font-normal normal-case tracking-normal text-text-tertiary">
            {totalTerminalCount}/6
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            title="Split terminal pane"
            onClick={() =>
              splitTerminalGroup(activeTerminalGroupId ?? undefined)
            }
            disabled={!canSplit}
          >
            <SplitSquareHorizontal size={13} />
          </button>

          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            title="Collapse terminal (Ctrl+J)"
            onClick={toggleTerminal}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {terminalGrid.length > 0 ? (
        <PanelGroup orientation="horizontal" className="min-h-0 flex-1">
          {terminalGrid.map((groupId, idx) => (
            <Fragment key={groupId}>
              <Panel
                minSize={30}
                defaultSize={Math.floor(100 / Math.max(1, terminalGrid.length))}
                className="min-h-0"
              >
                <TerminalGroupPane
                  projectId={projectId}
                  userId={userId}
                  containerStatus={containerStatus}
                  groupId={groupId}
                />
              </Panel>
              {idx < terminalGrid.length - 1 && (
                <PanelResizeHandle className="relative z-10 w-1 shrink-0 cursor-col-resize bg-border-subtle transition-colors hover:bg-accent-primary active:bg-accent-primary" />
              )}
            </Fragment>
          ))}
        </PanelGroup>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-bg-primary">
          <button
            className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            onClick={() => openNewTerminal()}
          >
            <Plus size={14} />
            <span>Create terminal</span>
          </button>
        </div>
      )}
    </div>
  );
}
