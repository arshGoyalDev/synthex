import { useEditorStore } from "../../stores/editor.store";
import { X, FileCode, FileJson, FileText, FileType } from "lucide-react";

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
      return <FileText size={14} className="text-gray-500" />;
    default:
      return <FileText size={14} className="text-zinc-500" />;
  }
}

export function EditorTabs() {
  const openTabs = useEditorStore((s) => s.openTabs);
  const activeFile = useEditorStore((s) => s.activeFile);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const closeTab = useEditorStore((s) => s.closeTab);
  const files = useEditorStore((s) => s.files);
  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-stretch bg-bg-dark-secondary border-b border-border-subtle shrink-0 h-[38px] overflow-hidden">
      <div className="flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {openTabs.map((path) => {
          const file = files.get(path);
          if (!file) return null;
          const isActive = path === activeFile;
          return (
            <button
              key={path}
              className={`group flex items-center gap-0.5 pl-4 pr-2 h-full border-r border-border-subtle bg-transparent text-[13px] font-sans cursor-pointer whitespace-nowrap transition-colors duration-150 shrink-0 relative ${
                isActive
                  ? "bg-bg-primary text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary hover:bg-white/[0.03]"
              }`}
              onClick={() => setActiveFile(path)}
            >
              {getFileIcon(file.name)}
              <span className={`pointer-events-none ${isActive ? "font-medium" : "font-normal"}`}>
                {file.name}
              </span>
              <span
                className={`flex items-center justify-center w-5 h-5 rounded ml-0.5 text-text-tertiary transition-all duration-100 hover:bg-white/10 hover:!text-text-primary hover:!opacity-100 ${
                  isActive ? "opacity-60" : "opacity-0 group-hover:opacity-60"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(path);
                }}
              >
                <X size={14} />
              </span>

              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary rounded-t" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
