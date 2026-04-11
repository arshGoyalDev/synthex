import { useState, useEffect, useRef } from "react";
import { Search, FileCode, FileType, FileJson, FileText, File } from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";
import type { FileEntry } from "../../stores/editor.store";

function getLocalFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return <FileCode size={14} className="text-blue-500 shrink-0" />;
    case "css":
      return <FileType size={14} className="text-purple-500 shrink-0" />;
    case "json":
      return <FileJson size={14} className="text-yellow-500 shrink-0" />;
    case "md":
      return <FileText size={14} className="text-gray-500 shrink-0" />;
    default:
      return <File size={14} className="text-zinc-500 shrink-0" />;
  }
}

export function FilePalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const filesMap = useEditorStore((s) => s.files);
  const groups = useEditorStore((s) => s.groups);
  const openFile = useEditorStore((s) => s.openFile);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle with Ctrl+P or Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (listRef.current && isOpen) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  let filteredFiles: FileEntry[] = [];
  if (query.trim() === "") {
    // Default to open tabs across all split view groups
    const allOpenTabs = Array.from(new Set(Object.values(groups).flatMap(g => g.openTabs)));
    filteredFiles = allOpenTabs
      .map((path) => filesMap.get(path))
      .filter(Boolean) as FileEntry[];
  } else {
    // Search all files
    const allFiles = Array.from(filesMap.values());
    filteredFiles = allFiles.filter((f) => 
      f.name.toLowerCase().includes(query.toLowerCase()) || 
      f.path.toLowerCase().includes(query.toLowerCase())
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredFiles.length === 0) return;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredFiles.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filteredFiles[selectedIndex];
      if (selected) {
        openFile(selected);
        setIsOpen(false);
      }
    }
  };

  const handleSelect = (file: FileEntry) => {
    openFile(file);
    setIsOpen(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/20 backdrop-blur-[2px]"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-[500px] max-w-[90vw] bg-bg-secondary border border-border-default rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-12 border-b border-border-subtle bg-bg-tertiary shrink-0">
          <Search size={16} className="text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-text-primary text-[13px] font-sans placeholder:text-text-tertiary"
            placeholder="Search files by name (Ctrl+P to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-2" ref={listRef}>
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file, idx) => (
              <button
                key={file.path}
                className={`w-full flex items-center justify-between px-4 py-2.5 cursor-pointer border-none text-left transition-colors ${
                  idx === selectedIndex ? "bg-accent-primary/20 text-text-primary" : "bg-transparent text-text-secondary hover:bg-white/5"
                }`}
                onClick={() => handleSelect(file)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getLocalFileIcon(file.name)}
                  <div className="flex flex-col truncate">
                    <span className="text-[13px] font-medium text-text-primary">{file.name}</span>
                    <span className="text-[11px] text-text-tertiary truncate leading-relaxed">{file.path}</span>
                  </div>
                </div>
                {query.trim() === "" && (
                  <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wider shrink-0 bg-white/5 px-1.5 py-0.5 rounded">
                    Opened
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-text-tertiary">
              No matching files found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
