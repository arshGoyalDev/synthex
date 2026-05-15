import React, { useEffect, createContext, useContext } from "react";
import { FileExplorer } from "./FileExplorer";
import { Terminal } from "./Terminal";
import { OutputPanel } from "./OutputPanel";
import { PreviewPanel } from "./PreviewPanel";
import { Pane } from "./Pane";
import { useEditorStore } from "../../stores/editor.store";
import { useFileSync } from "../../hooks/useFileSync";
import { useExecution } from "../../hooks/useExecution";
import { usePreview } from "../../hooks/usePreview";
import {
  Files,
  Search,
  TerminalSquare,
  Play,
  Globe,
  X,
  ChevronUp,
} from "lucide-react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { GlobalSearch } from "./GlobalSearch";

// ─── Context for file-sync actions ──────────────────────────────────────────

export interface FileSyncActions {
  fetchFileContent: (filePath: string) => Promise<void>;
  saveFileNow: (filePath: string) => Promise<void>;
  createFileOnServer: (
    path: string,
    name: string,
    isFolder: boolean,
  ) => Promise<void>;
  renameFileOnServer: (
    oldPath: string,
    newPath: string,
    newName: string,
  ) => Promise<void>;
  deleteFileOnServer: (path: string) => Promise<void>;
}

const FileSyncContext = createContext<FileSyncActions | null>(null);

export function useFileSyncActions(): FileSyncActions | null {
  return useContext(FileSyncContext);
}

// ─── Execution context ──────────────────────────────────────────────────────

import type { UseExecutionReturn } from "../../hooks/useExecution";
import type { UsePreviewReturn } from "../../hooks/usePreview";

export interface ExecutionContextData {
  execution: UseExecutionReturn;
  preview: UsePreviewReturn;
  runCommand: string | null;
  previewCommand: string | null;
  previewPort: number | null;
  templateId: string | null;
}

const ExecutionContext = createContext<ExecutionContextData | null>(null);

export function useExecutionContext(): ExecutionContextData | null {
  return useContext(ExecutionContext);
}

// ─── Component ──────────────────────────────────────────────────────────────

interface EditorLayoutProps {
  projectId: string;
  projectName: string;
  userId: string;
  containerStatus: string;
  runCommand: string | null;
  previewCommand: string | null;
  previewPort: number | null;
  templateId: string | null;
}

export function EditorLayout({
  projectId,
  projectName,
  userId,
  containerStatus,
  runCommand,
  previewCommand,
  previewPort,
  templateId,
}: EditorLayoutProps) {
  const isExplorerOpen = useEditorStore((s) => s.isExplorerOpen);
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const sidebarTab = useEditorStore((s) => s.sidebarTab);
  const setSidebarTab = useEditorStore((s) => s.setSidebarTab);
  const bottomPanelTab = useEditorStore((s) => s.bottomPanelTab);
  const setBottomPanelTab = useEditorStore((s) => s.setBottomPanelTab);
  const grid = useEditorStore((s) => s.grid);
  const toggleTerminal = useEditorStore((s) => s.toggleTerminal);
  const openNewTerminal = useEditorStore((s) => s.openNewTerminal);
  const activeGroupId = useEditorStore((s) => s.activeGroupId);
  const activeFile = useEditorStore(
    (s) => s.groups[activeGroupId]?.activeFile ?? null,
  );

  // ─── Hooks ────────────────────────────────────────────────────────────
  const fileSyncActions = useFileSync({ projectId, userId, containerStatus });
  const execution = useExecution(projectId, projectName);
  const preview = usePreview(projectId, projectName);

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hasModifier = event.ctrlKey || event.metaKey;
      if (!hasModifier) return;

      const key = event.key.toLowerCase();

      if (key === "j") {
        event.preventDefault();
        toggleTerminal();
        return;
      }

      if (key === "s") {
        if (!activeFile) return;
        event.preventDefault();
        // Immediate save on Ctrl+S
        fileSyncActions.saveFileNow(activeFile);
        return;
      }

      const isOpenTerminalShortcut =
        event.shiftKey && (event.code === "Slash" || event.key === "?");

      if (isOpenTerminalShortcut) {
        event.preventDefault();
        openNewTerminal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleTerminal, openNewTerminal, activeFile, fileSyncActions]);

  const executionCtx: ExecutionContextData = {
    execution,
    preview,
    runCommand,
    previewCommand,
    previewPort,
    templateId,
  };

  // ─── Bottom panel tab buttons ─────────────────────────────────────────
  const bottomTabs: {
    id: "terminal" | "output" | "preview";
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      id: "terminal",
      label: "Terminal",
      icon: <TerminalSquare size={13} />,
    },
    {
      id: "output",
      label: "Output",
      icon: <Play size={13} />,
      badge: execution.isRunning ? (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      ) : execution.status === "failed" || execution.status === "error" ? (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      ) : execution.status === "completed" ? (
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      ) : null,
    },
    {
      id: "preview",
      label: "Preview",
      icon: <Globe size={13} />,
      badge:
        preview.previewStatus === "ready" ? (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        ) : preview.previewStatus === "starting" ? (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        ) : null,
    },
  ];

  return (
    <FileSyncContext.Provider value={fileSyncActions}>
      <ExecutionContext.Provider value={executionCtx}>
        <div className="flex h-full overflow-hidden bg-bg-secondary">
          {/* Activity Bar (Leftmost) */}
          <div className="w-12 shrink-0 flex flex-col items-center py-1 gap-1 bg-bg-secondary border-r border-border-subtle z-20">
            <button
              className={`flex items-center justify-center w-10 h-10 rounded-md border-none cursor-pointer transition-all duration-200 ${
                isExplorerOpen && sidebarTab === "files"
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "bg-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary"
              }`}
              onClick={() => {
                if (isExplorerOpen && sidebarTab === "files") {
                  useEditorStore.getState().toggleExplorer();
                } else {
                  setSidebarTab("files");
                }
              }}
              title="Explorer"
            >
              <Files size={20} strokeWidth={2} />
            </button>

            <button
              className={`flex items-center justify-center w-10 h-10 rounded-md border-none cursor-pointer transition-all duration-200 ${
                isExplorerOpen && sidebarTab === "search"
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "bg-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary"
              }`}
              onClick={() => {
                if (isExplorerOpen && sidebarTab === "search") {
                  useEditorStore.getState().toggleExplorer();
                } else {
                  setSidebarTab("search");
                }
              }}
              title="Search"
            >
              <Search size={20} strokeWidth={2} />
            </button>
          </div>

          <PanelGroup orientation="horizontal">
            {/* Sidebar Pane */}
            {isExplorerOpen && (
              <>
                <Panel
                  id="sidebar"
                  defaultSize={280}
                  minSize={15}
                  maxSize={480}
                  className="flex flex-col bg-bg-secondary z-10 border-r border-border-subtle"
                >
                  {sidebarTab === "files" ? (
                    <FileExplorer />
                  ) : (
                    <GlobalSearch />
                  )}
                </Panel>
                <PanelResizeHandle className="w-1 shrink-0 bg-transparent hover:bg-accent-primary active:bg-accent-primary transition-colors cursor-col-resize z-10 relative" />
              </>
            )}

            {/* Right — Editor + Bottom Panel */}
            <Panel
              id="main"
              className="flex flex-col min-w-0 bg-bg-primary overflow-visible"
            >
              <PanelGroup orientation="vertical">
                {/* Top — Editor Grid */}
                <Panel
                  id="editors"
                  className="flex flex-col min-h-0 bg-bg-dark-secondary"
                >
                  <PanelGroup orientation="vertical">
                    {grid.map((row, rIdx) => (
                      <React.Fragment key={rIdx}>
                        {rIdx > 0 && (
                          <PanelResizeHandle className="h-[2px] bg-border-subtle hover:bg-accent-primary transition-colors cursor-row-resize relative z-10" />
                        )}
                        <Panel
                          minSize={5}
                          className="flex flex-col min-h-0 min-w-0"
                        >
                          <PanelGroup orientation="horizontal">
                            {row.map((groupId, cIdx) => (
                              <React.Fragment key={groupId}>
                                {cIdx > 0 && (
                                  <PanelResizeHandle className="w-[2px] bg-border-subtle hover:bg-accent-primary transition-colors cursor-col-resize relative z-10" />
                                )}
                                <Panel
                                  minSize={5}
                                  className="flex flex-col min-h-0 min-w-0 bg-bg-primary"
                                >
                                  <Pane groupId={groupId} />
                                </Panel>
                              </React.Fragment>
                            ))}
                          </PanelGroup>
                        </Panel>
                      </React.Fragment>
                    ))}
                  </PanelGroup>
                </Panel>

                {/* Bottom — Terminal / Output / Preview */}
                {isTerminalOpen && (
                  <>
                    <PanelResizeHandle className="h-1 shrink-0 bg-border-subtle hover:bg-accent-primary active:bg-accent-primary transition-colors cursor-row-resize z-10 relative" />
                    <Panel
                      id="bottom-panel"
                      defaultSize={320}
                      minSize={100}
                      maxSize={720}
                      className="flex flex-col"
                    >
                      {/* Bottom panel tab bar */}
                      <div className="flex h-[30px] shrink-0 items-center border-b border-border-subtle bg-bg-dark-secondary">
                        <div className="flex flex-1 items-center">
                          {bottomTabs.map((tab) => (
                            <button
                              key={tab.id}
                              className={`flex items-center gap-1.5 h-full px-3 text-[11px] font-medium border-b-2 transition-colors ${
                                bottomPanelTab === tab.id
                                  ? "border-accent-primary text-text-primary bg-bg-primary/40"
                                  : "border-transparent text-text-tertiary hover:text-text-secondary hover:bg-white/[0.02]"
                              }`}
                              onClick={() => setBottomPanelTab(tab.id)}
                            >
                              {tab.icon}
                              <span>{tab.label}</span>
                              {tab.badge}
                            </button>
                          ))}
                        </div>

                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary mr-1"
                          title="Collapse panel (Ctrl+J)"
                          onClick={toggleTerminal}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Panel content */}
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <div
                          className={
                            bottomPanelTab === "terminal"
                              ? "h-full"
                              : "hidden"
                          }
                        >
                          <Terminal
                            projectId={projectId}
                            userId={userId}
                            containerStatus={containerStatus}
                          />
                        </div>
                        <div
                          className={
                            bottomPanelTab === "output"
                              ? "h-full"
                              : "hidden"
                          }
                        >
                          <OutputPanel
                            execution={execution}
                            runCommand={runCommand}
                          />
                        </div>
                        <div
                          className={
                            bottomPanelTab === "preview"
                              ? "h-full"
                              : "hidden"
                          }
                        >
                          <PreviewPanel
                            preview={preview}
                            projectId={projectId}
                          />
                        </div>
                      </div>
                    </Panel>
                  </>
                )}
              </PanelGroup>

              {!isTerminalOpen && (
                <div className="shrink-0 h-8 border-t border-border-subtle flex items-center justify-between bg-bg-dark-secondary px-3">
                  <div className="flex items-center gap-3">
                    {bottomTabs.map((tab) => (
                      <button
                        key={tab.id}
                        className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
                        onClick={() => setBottomPanelTab(tab.id)}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.badge}
                      </button>
                    ))}
                  </div>
                  <button
                    className="flex h-6 items-center justify-center gap-1 rounded-md border border-border-subtle bg-bg-secondary px-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                    title="Open panel (Ctrl+J)"
                    onClick={toggleTerminal}
                  >
                    <ChevronUp size={12} />
                    <span>Open</span>
                  </button>
                </div>
              )}
            </Panel>
          </PanelGroup>
        </div>
      </ExecutionContext.Provider>
    </FileSyncContext.Provider>
  );
}
