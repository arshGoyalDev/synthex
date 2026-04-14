import { useEditorStore } from "../../stores/editor.store";
import {
  X,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";

/* ——— File icon by extension ——— */
function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return <FileCode size={14} className="text-blue-500" />;
    case "css":
      return <FileType size={14} className="text-purple-500" />;
    case "json":
      return <FileJson size={14} className="text-yellow-500" />;
    case "md":
      return <FileText size={14} className="text-text-tertiary" />;
    default:
      return <FileText size={14} className="text-text-tertiary" />;
  }
}

export function EditorTabs({ groupId }: { groupId: string }) {
  const group = useEditorStore((s) => s.groups[groupId]);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const closeTab = useEditorStore((s) => s.closeTab);
  const openPreviewToSide = useEditorStore((s) => s.openPreviewToSide);
  const files = useEditorStore((s) => s.files);
  const isPreviewActive = useEditorStore(
    (s) =>
      !!group?.activeFile &&
      Object.values(s.groups).some(
        (g) => g.isPreviewMode && g.activeFile === group.activeFile,
      ),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
  };

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [group?.openTabs.length]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = 150;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
    // Give it a moment to update state after smooth scroll starts
    setTimeout(updateScrollState, 300);
  };

  if (!group || group.openTabs.length === 0) return null;

  const activeFileObj = files.get(group.activeFile || "");
  const isMarkdown = activeFileObj?.name?.endsWith(".md");

  return (
    <div className="flex items-stretch bg-bg-dark-secondary border-b border-border-subtle shrink-0 h-[32px] overflow-hidden justify-between relative">
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="flex items-center justify-center w-6 bg-bg-secondary border-r border-border-subtle text-text-tertiary hover:text-text-primary shrink-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.1)] cursor-pointer"
        >
          <ChevronLeft size={14} />
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1 relative"
      >
        {group.openTabs.map((path) => {
          const file = files.get(path);
          if (!file) return null;
          const isActive = path === group.activeFile;
          return (
            <button
              key={path}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/vnd.synthex.tab",
                  JSON.stringify({ path, sourceGroupId: groupId }),
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className={`group flex items-center gap-0.5 pl-3 pr-1 h-full border-r border-border-subtle bg-transparent text-[12px] font-sans cursor-pointer whitespace-nowrap transition-colors duration-150 shrink-0 relative ${
                isActive
                  ? "bg-bg-primary text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-white/[0.03]"
              }`}
              onClick={() => setActiveFile(path, groupId)}
            >
              {getFileIcon(file.name)}
              <span
                className={`pointer-events-none ${isActive ? "text-text-primary" : "text-text-secondary"}`}
              >
                {file.name}
              </span>
              <span
                className={`flex items-center justify-center w-5 h-5 rounded ml-0.5 text-text-tertiary transition-all duration-100 hover:bg-white/10 hover:!text-text-primary hover:!opacity-100 ${
                  isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(path, groupId);
                }}
              >
                <X size={14} />
              </span>

              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-t pointer-events-none" />
              )}
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="flex items-center justify-center w-6 bg-bg-secondary border-l border-border-subtle text-text-tertiary hover:text-text-primary shrink-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.1)] cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Markdown Preview Toggle */}
      {isMarkdown && !group.isPreviewMode && (
        <button
          className={`flex items-center gap-1.5 px-4 border-l border-border-subtle cursor-pointer text-xs h-full shrink-0 outline-none font-medium transition-colors ${
            isPreviewActive
              ? "bg-accent-primary/15 text-accent-primary"
              : "bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5"
          }`}
          onClick={() => openPreviewToSide(groupId)}
        >
          <Eye size={14} /> Preview
        </button>
      )}
    </div>
  );
}
