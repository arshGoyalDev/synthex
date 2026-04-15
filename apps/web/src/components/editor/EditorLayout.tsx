import React, { useEffect } from "react";
import { FileExplorer } from "./FileExplorer";
import { Terminal } from "./Terminal";
import { Pane } from "./Pane";
import { useEditorStore } from "../../stores/editor.store";
import { Files, Search } from "lucide-react";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { GlobalSearch } from "./GlobalSearch";

interface EditorLayoutProps {
  projectId: string;
  userId: string;
  containerStatus: string;
}

export function EditorLayout({
  projectId,
  userId,
  containerStatus,
}: EditorLayoutProps) {
  const isExplorerOpen = useEditorStore((s) => s.isExplorerOpen);
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const sidebarTab = useEditorStore((s) => s.sidebarTab);
  const setSidebarTab = useEditorStore((s) => s.setSidebarTab);
  const grid = useEditorStore((s) => s.grid);
  const toggleTerminal = useEditorStore((s) => s.toggleTerminal);
  const openNewTerminal = useEditorStore((s) => s.openNewTerminal);

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

      const isOpenTerminalShortcut =
        event.shiftKey && (event.code === "Slash" || event.key === "?");

      if (isOpenTerminalShortcut) {
        event.preventDefault();
        openNewTerminal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleTerminal, openNewTerminal]);

  return (
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
              {sidebarTab === "files" ? <FileExplorer /> : <GlobalSearch />}
            </Panel>
            <PanelResizeHandle className="w-1 shrink-0 bg-transparent hover:bg-accent-primary active:bg-accent-primary transition-colors cursor-col-resize z-10 relative" />
          </>
        )}

        {/* Right — Editor + Terminal */}
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

            {/* Bottom — Terminal */}
            {isTerminalOpen && (
              <>
                <PanelResizeHandle className="h-1 shrink-0 bg-border-subtle hover:bg-accent-primary active:bg-accent-primary transition-colors cursor-row-resize z-10 relative" />
                <Panel
                  id="terminal"
                  defaultSize={320}
                  minSize={100}
                  maxSize={720}
                  className="flex flex-col"
                >
                  <Terminal
                    projectId={projectId}
                    userId={userId}
                    containerStatus={containerStatus}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>

          {!isTerminalOpen && (
            <div className="shrink-0 h-8 border-t border-border-subtle">
              <Terminal
                projectId={projectId}
                userId={userId}
                containerStatus={containerStatus}
              />
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}
