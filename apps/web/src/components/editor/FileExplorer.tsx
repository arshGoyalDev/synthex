import { useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from "lucide-react";
import { useEditorStore, DUMMY_FILES } from "../../stores/editor.store";

/* ——— Tree data types ——— */
interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
}

/* Build a tree from the flat dummy files list */
function buildTree(): TreeNode {
  const root: TreeNode = {
    name: "my-project",
    path: "/",
    isFolder: true,
    children: [],
  };

  for (const file of DUMMY_FILES) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const partPath = "/" + parts.slice(0, i + 1).join("/");

      if (isLast) {
        current.children!.push({
          name: parts[i],
          path: partPath,
          isFolder: false,
        });
      } else {
        let existing = current.children!.find(
          (c) => c.isFolder && c.name === parts[i]
        );
        if (!existing) {
          existing = {
            name: parts[i],
            path: partPath,
            isFolder: true,
            children: [],
          };
          current.children!.push(existing);
        }
        current = existing;
      }
    }
  }

  const sortChildren = (node: TreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  return root;
}

const fileTree = buildTree();

/* ——— File icon color by extension ——— */
function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return "#3b82f6";
    case "css":
      return "#a855f7";
    case "json":
      return "#eab308";
    case "md":
      return "#6b7280";
    default:
      return "#71717a";
  }
}

/* ——— Tree node component ——— */
function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const activeFile = useEditorStore((s) => s.activeFile);
  const openFile = useEditorStore((s) => s.openFile);
  const files = useEditorStore((s) => s.files);

  const handleClick = useCallback(() => {
    if (node.isFolder) {
      setExpanded((e) => !e);
    } else {
      const file = files.get(node.path);
      if (file) openFile(file);
    }
  }, [node, files, openFile]);

  const isActive = !node.isFolder && activeFile === node.path;

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1 w-full h-7 border-none bg-transparent text-text-secondary text-[13px] font-sans cursor-pointer transition-colors duration-100 text-left whitespace-nowrap hover:bg-white/[0.04] hover:text-text-primary ${
          isActive ? "bg-accent-primary/10 text-text-primary" : ""
        }`}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        {/* Chevron / spacer */}
        <span className="flex items-center justify-center w-3.5 shrink-0 text-text-tertiary">
          {node.isFolder ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </span>

        {/* Icon */}
        <span className="flex items-center shrink-0">
          {node.isFolder ? (
            expanded ? (
              <FolderOpen size={15} color="#eab308" />
            ) : (
              <Folder size={15} color="#eab308" />
            )
          ) : (
            <File size={15} color={getFileColor(node.name)} />
          )}
        </span>

        {/* Name */}
        <span className="overflow-hidden text-ellipsis">{node.name}</span>
      </button>

      {/* Children */}
      {node.isFolder && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

/* ——— File Explorer ——— */
export function FileExplorer() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-3.5 py-2.5 text-[11px] font-semibold tracking-wide uppercase text-text-tertiary border-b border-border-subtle shrink-0">
        <span>EXPLORER</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.children?.map((child) => (
          <TreeItem key={child.path} node={child} depth={0} />
        ))}
      </div>
    </div>
  );
}
