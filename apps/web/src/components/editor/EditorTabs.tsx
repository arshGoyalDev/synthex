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
  AlertTriangle,
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { useSaveFile } from "../../hooks/useSaveFile";

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

/* ——— Unsaved changes dialog ——— */
interface UnsavedDialogProps {
  fileName: string;
  onSave: () => Promise<void>;
  onDontSave: () => void;
  onCancel: () => void;
}

function UnsavedDialog({ fileName, onSave, onDontSave, onCancel }: UnsavedDialogProps) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  // Close on backdrop click
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

      {/* Dialog */}
      <div className="relative z-10 w-[420px] rounded-xl border border-border-subtle bg-bg-secondary shadow-2xl shadow-black/60 animate-[fadeScaleIn_0.12s_ease-out]">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500/10">
            <AlertTriangle size={18} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-text-primary leading-snug">
              Do you want to save the changes you made to&nbsp;
              <span className="text-accent-primary">{fileName}</span>?
            </p>
            <p className="mt-1.5 text-[12px] text-text-tertiary leading-relaxed">
              Your changes will be lost if you don&apos;t save them.
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle mx-4" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            className="h-7 rounded-md px-3 text-[12px] font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            onClick={onDontSave}
          >
            Don&apos;t Save
          </button>
          <button
            className="h-7 rounded-md px-3 text-[12px] font-medium text-text-secondary border border-border-subtle transition-colors hover:bg-white/5 hover:text-text-primary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="h-7 rounded-md px-4 text-[12px] font-semibold bg-accent-primary text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
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

  const saveFile = useSaveFile();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Pending close: { path, name } when waiting for user to decide
  const [pendingClose, setPendingClose] = useState<{ path: string; name: string } | null>(null);

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
    scrollRef.current.scrollBy({
      left: direction === "left" ? -150 : 150,
      behavior: "smooth",
    });
    setTimeout(updateScrollState, 300);
  };

  const handleCloseRequest = useCallback(
    (path: string) => {
      const file = files.get(path);
      if (file?.isDirty) {
        setPendingClose({ path, name: file.name });
      } else {
        closeTab(path, groupId);
      }
    },
    [files, closeTab, groupId],
  );

  const handleDialogSave = useCallback(async () => {
    if (!pendingClose) return;
    await saveFile(pendingClose.path);
    closeTab(pendingClose.path, groupId);
    setPendingClose(null);
  }, [pendingClose, saveFile, closeTab, groupId]);

  const handleDialogDontSave = useCallback(() => {
    if (!pendingClose) return;
    closeTab(pendingClose.path, groupId);
    setPendingClose(null);
  }, [pendingClose, closeTab, groupId]);

  const handleDialogCancel = useCallback(() => {
    setPendingClose(null);
  }, []);

  if (!group || group.openTabs.length === 0) return null;

  const activeFileObj = files.get(group.activeFile || "");
  const isMarkdown = activeFileObj?.name?.endsWith(".md");

  return (
    <>
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
            const isDirty = !!file.isDirty;

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

                {/* Filename — italic when dirty */}
                <span
                  className={`pointer-events-none ml-0.5 ${
                    isActive ? "text-text-primary" : "text-text-secondary"
                  } ${isDirty ? "italic" : ""}`}
                >
                  {file.name}
                </span>

                {/* Close / dirty indicator */}
                {isDirty ? (
                  /* Unsaved: show a dot that becomes X on hover */
                  <span
                    className={`relative flex items-center justify-center w-5 h-5 rounded ml-0.5 transition-all duration-100 hover:bg-white/10 ${
                      isActive ? "opacity-80" : "opacity-0 group-hover:opacity-60"
                    }`}
                    title="Unsaved changes — click to close"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseRequest(path);
                    }}
                  >
                    {/* Dot (visible when not hovering this span) */}
                    <span className="absolute inset-0 flex items-center justify-center group-[&:not(:hover)]:flex peer">
                      <span className="w-2 h-2 rounded-full bg-text-secondary group-hover:opacity-0 transition-opacity" />
                    </span>
                    {/* X (visible on hover) */}
                    <X
                      size={13}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:!text-text-primary"
                    />
                  </span>
                ) : (
                  /* Saved: normal X button */
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
                )}

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

      {/* Unsaved-changes dialog */}
      {pendingClose && (
        <UnsavedDialog
          fileName={pendingClose.name}
          onSave={handleDialogSave}
          onDontSave={handleDialogDontSave}
          onCancel={handleDialogCancel}
        />
      )}
    </>
  );
}
