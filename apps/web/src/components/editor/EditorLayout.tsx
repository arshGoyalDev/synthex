import { useState, useCallback, useRef, useEffect } from "react";
import { FileExplorer } from "./FileExplorer";
import { EditorTabs } from "./EditorTabs";
import { CodeEditor } from "./CodeEditor";
import { Terminal } from "./Terminal";
import { EditorBreadcrumbs } from "./EditorBreadcrumbs";
import { MarkdownPreview } from "./MarkdownPreview";
import { useEditorStore } from "../../stores/editor.store";
import { Files } from "lucide-react";

export function EditorLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [terminalHeight, setTerminalHeight] = useState(360);
  const isExplorerOpen = useEditorStore((s) => s.isExplorerOpen);
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const isPreviewMode = useEditorStore((s) => s.isPreviewMode);
  const activeFile = useEditorStore((s) => s.activeFile);

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
      <div className="w-12 shrink-0 flex flex-col items-center py-2 bg-bg-secondary border-r border-border-subtle z-20">
        <button
          className={`flex items-center justify-center w-10 h-10 rounded-xl border-none cursor-pointer transition-all duration-200 ${
            isExplorerOpen
              ? "bg-accent-primary/10 text-accent-primary"
              : "bg-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary"
          }`}
          onClick={() => useEditorStore.getState().toggleExplorer()}
          title="Explorer"
        >
          <Files size={20} strokeWidth={2} />
        </button>
      </div>

      {/* File Explorer Pane */}
      {isExplorerOpen && (
        <>
          <aside
            className="shrink-0 flex flex-col overflow-hidden border-r border-border-subtle bg-bg-secondary"
            style={{ width: sidebarWidth }}
          >
            <FileExplorer />
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
        {/* Top — Tabs + Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-bg-primary">
          <EditorTabs />
          <EditorBreadcrumbs />
          <div className="flex-1 relative flex flex-col min-h-0">
            {isPreviewMode && activeFile?.endsWith(".md") ? (
               <MarkdownPreview />
            ) : (
               <CodeEditor />
            )}
          </div>
        </div>

        {/* Bottom — Terminal */}
        {isTerminalOpen && (
          <div
            className="h-1 shrink-0 cursor-row-resize relative z-10 transition-colors duration-150 hover:bg-accent-primary active:bg-accent-primary"
            onMouseDown={startTerminalDrag}
          />
        )}
        <div className="shrink-0" style={{ height: isTerminalOpen ? terminalHeight : 32 }}>
          <Terminal />
        </div>
      </div>
    </div>
  );
}
