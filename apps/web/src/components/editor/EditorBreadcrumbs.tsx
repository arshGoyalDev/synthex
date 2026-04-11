import { ChevronRight, FileCode, FileJson, FileText, File as FileIcon } from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";

function getLocalFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return <FileCode size={12} className="text-[#3b82f6] shrink-0 mx-1" />;
    case "json":
      return <FileJson size={12} className="text-[#eab308] shrink-0 mx-1" />;
    case "md":
      return <FileText size={12} className="text-[#6b7280] shrink-0 mx-1" />;
    default:
      return <FileIcon size={12} className="text-[#71717a] shrink-0 mx-1" />;
  }
}

export function EditorBreadcrumbs({ groupId }: { groupId: string }) {
  const group = useEditorStore((s) => s.groups[groupId]);
  
  if (!group || !group.activeFile) return null;

  const parts = group.activeFile.split("/").filter(Boolean);

  return (
    <div className="flex items-center px-4 h-6 shrink-0 bg-bg-primary border-b border-border-subtle text-[12px] font-mono text-text-tertiary select-none">
      <span className="hover:text-text-primary transition-colors cursor-pointer tracking-tight">my-project</span>
      {parts.length > 0 && <ChevronRight size={12} className="mx-1.5 opacity-50 shrink-0" />}
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        return (
          <div key={i} className="flex items-center tracking-tight">
            {i > 0 && <ChevronRight size={12} className="mx-1.5 opacity-50 shrink-0" />}
            {isLast && getLocalFileIcon(part)}
            <span className={`hover:text-text-primary transition-colors cursor-pointer ${isLast ? 'text-text-secondary' : ''}`}>{part}</span>
          </div>
        );
      })}
    </div>
  );
}
