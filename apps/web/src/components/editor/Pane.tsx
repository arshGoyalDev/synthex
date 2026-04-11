import { useState } from "react";
import { EditorTabs } from "./EditorTabs";
import { EditorBreadcrumbs } from "./EditorBreadcrumbs";
import { CodeEditor } from "./CodeEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { useEditorStore } from "../../stores/editor.store";

export function Pane({ groupId }: { groupId: string }) {
  const group = useEditorStore(s => s.groups[groupId]);
  const splitPane = useEditorStore(s => s.splitPane);
  const openFile = useEditorStore(s => s.openFile);
  const closeTab = useEditorStore(s => s.closeTab);
  const files = useEditorStore(s => s.files);
  const setActiveGroup = useEditorStore(s => s.setActiveGroup);
  const activeGroupId = useEditorStore(s => s.activeGroupId);

  const [dragTarget, setDragTarget] = useState<"left"|"right"|"top"|"bottom"|"center"|null>(null);

  if (!group) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const threshold = 0.25;

    // Must be dragging a file or tab, otherwise ignore entirely
    if (!e.dataTransfer.types.includes("application/vnd.synthex.file") && 
        !e.dataTransfer.types.includes("application/vnd.synthex.tab")) {
       return;
    }

    if (x < w * threshold) setDragTarget("left");
    else if (x > w * (1 - threshold)) setDragTarget("right");
    else if (y < h * threshold) setDragTarget("top");
    else if (y > h * (1 - threshold)) setDragTarget("bottom");
    else setDragTarget("center");
  };

  const handleDragLeave = () => setDragTarget(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragTarget(null);

    const filePath = e.dataTransfer.getData("application/vnd.synthex.file");
    const tabData = e.dataTransfer.getData("application/vnd.synthex.tab");
    
    let path = filePath;
    let sourceGroupId = null;

    if (tabData) {
      try {
        const parsed = JSON.parse(tabData);
        path = parsed.path;
        sourceGroupId = parsed.sourceGroupId;
      } catch (err) {}
    }

    if (!path) return;

    const file = files.get(path);
    if (!file) return;

    if (dragTarget && dragTarget !== "center") {
      splitPane(path, dragTarget, groupId);
      if (sourceGroupId) closeTab(path, sourceGroupId);
    } else {
      openFile(file, groupId);
      if (sourceGroupId && sourceGroupId !== groupId) closeTab(path, sourceGroupId);
    }
  };

  return (
    <div 
      className={`relative flex-1 flex flex-col min-w-0 min-h-0 bg-bg-primary overflow-hidden ${activeGroupId === groupId ? 'ring-1 ring-inset ring-accent-primary/30 z-10' : 'z-0' }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClickCapture={() => setActiveGroup(groupId)}
    >
      <EditorTabs groupId={groupId} />
      <EditorBreadcrumbs groupId={groupId} />
      <div className="flex-1 relative flex flex-col min-h-0">
        {group.isPreviewMode && group.activeFile?.endsWith(".md") ? (
           <MarkdownPreview groupId={groupId} />
        ) : (
           <CodeEditor groupId={groupId} />
        )}
      </div>

      {/* Drop Overlays */}
      {dragTarget === "left" && <div className="absolute inset-y-0 left-0 w-1/4 bg-accent-primary/20 pointer-events-none z-50 transition-all border-r border-accent-primary backdrop-blur-[2px]" />}
      {dragTarget === "right" && <div className="absolute inset-y-0 right-0 w-1/4 bg-accent-primary/20 pointer-events-none z-50 transition-all border-l border-accent-primary backdrop-blur-[2px]" />}
      {dragTarget === "top" && <div className="absolute inset-x-0 top-0 h-1/4 bg-accent-primary/20 pointer-events-none z-50 transition-all border-b border-accent-primary backdrop-blur-[2px]" />}
      {dragTarget === "bottom" && <div className="absolute inset-x-0 bottom-0 h-1/4 bg-accent-primary/20 pointer-events-none z-50 transition-all border-t border-accent-primary backdrop-blur-[2px]" />}
      {dragTarget === "center" && <div className="absolute inset-0 bg-accent-primary/10 pointer-events-none z-50 transition-all backdrop-blur-[2px]" />}
    </div>
  );
}
