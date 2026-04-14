import { useState, useCallback, useRef, useEffect } from "react";
import React from "react";
import { FileExplorer } from "./FileExplorer";
import { Terminal } from "./Terminal";
import { Pane } from "./Pane";
import { useEditorStore } from "../../stores/editor.store";
import { Files, Search } from "lucide-react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { GlobalSearch } from "./GlobalSearch";

interface EditorLayoutProps {
  projectId: string;
  userId: string;
  containerStatus: string;
}

export function EditorLayout({ projectId, userId, containerStatus }: EditorLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [terminalHeight, setTerminalHeight] = useState(360);
  
  const isExplorerOpen = useEditorStore((s) => s.isExplorerOpen);
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const sidebarTab = useEditorStore((s) => s.sidebarTab);
  const setSidebarTab = useEditorStore((s) => s.setSidebarTab);
  const grid = useEditorStore((s) => s.grid);

  const layoutRef = useRef<HTMLDivElement>(null);
  const draggingSidebar = useRef(false);
  const draggingTerminal = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingSidebar.current && layoutRef.current) {
      const rect = layoutRef.current.getBoundingClientRect();
      const newWidth = Math.max(160, Math.min(e.clientX - rect.left, 480));
      setSidebarWidth(newWidth);
    }
    if (draggingTerminal.current && layoutRef.current) {
      const rect = layoutRef.current.getBoundingClientRect();
      const newHeight = Math.max(80, Math.min(rect.bottom - e.clientY, rect.height * 0.6));
      setTerminalHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    draggingSidebar.current = false;
    draggingTerminal.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startSidebarDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingSidebar.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const startTerminalDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingTerminal.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  return (
    <div className="flex h-full overflow-hidden" ref={layoutRef}>
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

      {/* Sidebar Pane */}
      {isExplorerOpen && (
        <>
          <aside
            className="shrink-0 flex flex-col overflow-hidden border-r border-border-subtle bg-bg-secondary relative"
            style={{ width: sidebarWidth }}
          >
            {sidebarTab === "files" ? <FileExplorer /> : <GlobalSearch />}
          </aside>

          {/* Sidebar resize handle */}
          <div
            className="w-1 shrink-0 cursor-col-resize relative z-10 transition-colors duration-150 hover:bg-accent-primary active:bg-accent-primary"
            onMouseDown={startSidebarDrag}
          />
        </>
      )}

      {/* Right — Editor + Terminal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top — Editor Grid */}
        <div className="flex-1 flex flex-col bg-bg-dark-secondary overflow-hidden min-h-0">
           <PanelGroup orientation="vertical">
              {grid.map((row, rIdx) => (
                 <React.Fragment key={rIdx}>
                    {rIdx > 0 && <PanelResizeHandle className="h-[2px] bg-border-subtle hover:bg-accent-primary transition-colors cursor-row-resize relative z-10" />}
                    <Panel minSize={5} className="flex flex-col min-h-0 min-w-0">
                       <PanelGroup orientation="horizontal">
                          {row.map((groupId, cIdx) => (
                             <React.Fragment key={groupId}>
                                {cIdx > 0 && <PanelResizeHandle className="w-[2px] bg-border-subtle hover:bg-accent-primary transition-colors cursor-col-resize relative z-10" />}
                                <Panel minSize={5} className="flex flex-col min-h-0 min-w-0 bg-bg-primary">
                                   <Pane groupId={groupId} />
                                </Panel>
                             </React.Fragment>
                          ))}
                       </PanelGroup>
                    </Panel>
                 </React.Fragment>
              ))}
           </PanelGroup>
        </div>

        {/* Bottom — Terminal */}
        {isTerminalOpen && (
          <div
            className="h-1 shrink-0 cursor-row-resize relative z-10 transition-colors duration-150 hover:bg-accent-primary active:bg-accent-primary"
            onMouseDown={startTerminalDrag}
          />
        )}
        <div className="shrink-0" style={{ height: isTerminalOpen ? terminalHeight : 32 }}>
          <Terminal projectId={projectId} userId={userId} containerStatus={containerStatus} />
        </div>
      </div>
    </div>
  );
}
