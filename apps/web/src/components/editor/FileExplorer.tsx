import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  MoreVertical,
  Edit2,
  Trash2,
  Copy,
  Scissors,
} from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";
import type { FileEntry } from "../../stores/editor.store";

/* ——— Tree data types ——— */
interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: TreeNode[];
}

export type CreatingNodeState = {
  parentPath: string;
  isFolder: boolean;
} | null;

/* Build a tree from the flat files map */
function buildTreeConfig(filesMap: Map<string, FileEntry>): TreeNode {
  const root: TreeNode = {
    name: "my-project",
    path: "/",
    isFolder: true,
    children: [],
  };

  for (const file of filesMap.values()) {
    const parts = file.path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const partPath = "/" + parts.slice(0, i + 1).join("/");

      let existing = current.children!.find((c) => c.name === parts[i]);
      if (!existing) {
        existing = {
          name: parts[i],
          path: partPath,
          isFolder: isLast ? !!file.isFolder : true,
          children: isLast && !file.isFolder ? undefined : [],
        };
        current.children!.push(existing);
      }
      current = existing;
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
      return "var(--color-text-tertiary)";
    default:
      return "var(--color-text-tertiary)";
  }
}

/* ——— Context Menu Type ——— */
type ContextMenuState = {
  node: TreeNode | null;
  x: number;
  y: number;
} | null;

/* ——— Inline Input Component ——— */
function InlineInput({
  depth,
  isFolder,
  initialValue = "",
  onSubmit,
  onCancel,
}: {
  depth: number;
  isFolder: boolean;
  initialValue?: string;
  onSubmit: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (initialValue) {
      // Select filename but exclude extension if possible
      const dotIdx = initialValue.lastIndexOf(".");
      if (dotIdx > 0 && !isFolder) {
        inputRef.current?.setSelectionRange(0, dotIdx);
      } else {
        inputRef.current?.select();
      }
    }
  }, [initialValue, isFolder]);

  return (
    <div
      className="flex items-center gap-1 w-full h-7 text-[13px]"
      style={{ paddingLeft: depth * 12 + 8 }}
    >
      <span className="flex items-center justify-center w-3.5 shrink-0" />
      <span className="flex items-center shrink-0">
        {isFolder ? (
          <Folder size={15} color="#eab308" />
        ) : (
          <FileIcon size={15} color={getFileColor(val || "default")} />
        )}
      </span>
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim()) {
            onSubmit(val.trim());
          } else {
            onCancel();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (val.trim()) {
              onSubmit(val.trim());
            } else {
              onCancel();
            }
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        className="flex-1 bg-bg-primary border border-accent-primary outline-none text-text-primary h-5 px-1 ml-0.5 rounded-sm"
      />
    </div>
  );
}

/* ——— Tree node component ——— */
function TreeItem({
  node,
  depth,
  focusedPath,
  setFocusedPath,
  onContextMenu,
  renamingPath,
  creatingNode,
  onRenameCommit,
  onRenameCancel,
  onCreateCommit,
  onCreateCancel,
}: {
  node: TreeNode;
  depth: number;
  focusedPath: string;
  setFocusedPath: (p: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renamingPath: string | null;
  creatingNode: CreatingNodeState;
  onRenameCommit: (node: TreeNode, newName: string) => void;
  onRenameCancel: () => void;
  onCreateCommit: (parentPath: string, name: string, isFolder: boolean) => void;
  onCreateCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const activeGroupId = useEditorStore((s) => s.activeGroupId);
  const activeFile = useEditorStore((s) => s.groups[activeGroupId]?.activeFile);
  const openFile = useEditorStore((s) => s.openFile);
  const files = useEditorStore((s) => s.files);

  // Auto-expand if a new child is being created here
  useEffect(() => {
    if (creatingNode && creatingNode.parentPath === node.path) {
      setExpanded(true);
    }
  }, [creatingNode, node.path]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setFocusedPath(
        node.isFolder
          ? node.path
          : node.path.substring(0, node.path.lastIndexOf("/")) || "/",
      );

      if (node.isFolder) {
        setExpanded((e) => !e);
      } else {
        const file = files.get(node.path);
        if (file) openFile(file);
      }
    },
    [node, files, openFile, setFocusedPath],
  );

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContextMenu(e, node);
  };

  const isActive = !node.isFolder && activeFile === node.path;
  const isFocused = node.isFolder && focusedPath === node.path;

  if (renamingPath === node.path) {
    return (
      <InlineInput
        depth={depth}
        isFolder={node.isFolder}
        initialValue={node.name}
        onSubmit={(newName) => onRenameCommit(node, newName)}
        onCancel={onRenameCancel}
      />
    );
  }

  return (
    <>
      <button
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, node);
        }}
        draggable={!node.isFolder}
        onDragStart={(e) => {
          if (!node.isFolder) {
            e.dataTransfer.setData("application/vnd.synthex.file", node.path);
            e.dataTransfer.effectAllowed = "copyMove";
          }
        }}
        className={`group flex items-center gap-1 w-full h-7 border-none bg-transparent text-[13px] font-sans cursor-pointer transition-colors duration-100 text-left whitespace-nowrap hover:bg-white/[0.04] ${
          isActive
            ? "bg-accent-primary/10 text-text-primary"
            : isFocused
              ? "bg-white/[0.02] text-text-primary outline outline-1 outline-white/10 -outline-offset-1"
              : "text-text-secondary hover:text-text-primary"
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
            <FileIcon size={15} color={getFileColor(node.name)} />
          )}
        </span>

        {/* Name */}
        <span className="overflow-hidden text-ellipsis flex-1 pr-1">
          {node.name}
        </span>

        {/* 3 dot menu (appears on hover) */}
        <div
          className="opacity-0 group-hover:opacity-100 pr-1 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-opacity"
          onClick={handleMenuClick}
        >
          <MoreVertical size={14} />
        </div>
      </button>

      {/* Children */}
      {node.isFolder && expanded && (
        <div>
          {creatingNode?.parentPath === node.path && (
            <InlineInput
              depth={depth + 1}
              isFolder={creatingNode.isFolder}
              onSubmit={(name) =>
                onCreateCommit(node.path, name, creatingNode.isFolder)
              }
              onCancel={onCreateCancel}
            />
          )}

          {node.children &&
            node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                focusedPath={focusedPath}
                setFocusedPath={setFocusedPath}
                onContextMenu={onContextMenu}
                renamingPath={renamingPath}
                creatingNode={creatingNode}
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
                onCreateCommit={onCreateCommit}
                onCreateCancel={onCreateCancel}
              />
            ))}
        </div>
      )}
    </>
  );
}

/* ——— File Explorer Main Component ——— */
export function FileExplorer() {
  const files = useEditorStore((s) => s.files);
  const createNode = useEditorStore((s) => s.createNode);
  const renameNode = useEditorStore((s) => s.renameNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);
  const clipboard = useEditorStore((s) => s.clipboard);
  const setClipboard = useEditorStore((s) => s.setClipboard);
  const pasteNode = useEditorStore((s) => s.pasteNode);

  const fileTree = useMemo(() => buildTreeConfig(files), [files]);

  const [focusedPath, setFocusedPath] = useState<string>("/");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingNode, setCreatingNode] = useState<CreatingNodeState>(null);
  const [deletingNode, setDeletingNode] = useState<TreeNode | null>(null);

  const explorerRef = useRef<HTMLDivElement>(null);

  // Focus root when clicking empty area
  const handleBackgroundClick = () => {
    setFocusedPath("/");
    setContextMenu(null);
  };

  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 160);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ node: null, x, y });
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: TreeNode) => {
      // Show near mouse but constrained
      const x = Math.min(e.clientX, window.innerWidth - 160);
      const y = Math.min(e.clientY, window.innerHeight - 250);
      setContextMenu({ node, x, y });
    },
    [],
  );

  // Inline Actions
  const handleCreateBtnClick = (isFolder: boolean) => {
    setCreatingNode({
      parentPath: focusedPath === "/" ? "/" : focusedPath,
      isFolder,
    });
  };

  const handleCreateCommit = (
    parentPath: string,
    name: string,
    isFolder: boolean,
  ) => {
    const cleanParent = parentPath === "/" ? "" : parentPath;
    const newPath = `${cleanParent}/${name}`;
    createNode(newPath, name, isFolder);
    setCreatingNode(null);
  };

  const handleCreateCancel = () => setCreatingNode(null);

  const handleRenameStart = () => {
    if (!contextMenu || !contextMenu.node) return;
    setRenamingPath(contextMenu.node.path);
    setContextMenu(null);
  };

  const handleRenameCommit = (node: TreeNode, newName: string) => {
    if (newName && newName !== node.name) {
      const dirPath = node.path.substring(0, node.path.lastIndexOf("/"));
      const newPath = `${dirPath}/${newName}`;
      renameNode(node.path, newPath, newName);
    }
    setRenamingPath(null);
  };

  const handleRenameCancel = () => setRenamingPath(null);

  const handleDeleteStart = () => {
    if (!contextMenu || !contextMenu.node) return;
    setDeletingNode(contextMenu.node);
    setContextMenu(null);
  };

  const handleDeleteConfirm = () => {
    if (deletingNode) {
      deleteNode(deletingNode.path);
    }
    setDeletingNode(null);
  };

  const handleClipboardCmd = (type: "copy" | "cut") => {
    if (!contextMenu || !contextMenu.node) return;
    setClipboard(contextMenu.node.path, type);
    setContextMenu(null);
  };

  const handlePasteCmd = () => {
    if (!contextMenu || !clipboard) return;
    const targetPath = contextMenu.node
      ? contextMenu.node.isFolder
        ? contextMenu.node.path
        : contextMenu.node.path.substring(
            0,
            contextMenu.node.path.lastIndexOf("/"),
          )
      : "/";
    pasteNode(targetPath === "" ? "/" : targetPath);
    setContextMenu(null);
  };

  // Close context menu on external clicks
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  return (
    <>
      <div
        className="flex flex-col h-full overflow-hidden select-none relative"
        ref={explorerRef}
        onClick={handleBackgroundClick}
        onContextMenu={handleBackgroundContextMenu}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 h-8 text-[11px] font-semibold tracking-wide uppercase text-text-tertiary border-b border-border-subtle shrink-0">
          <span>EXPLORER</span>
          <div className="flex items-center gap-1">
            <button
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 hover:text-text-primary text-text-tertiary transition-colors border-none bg-transparent cursor-pointer"
              title="New File"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateBtnClick(false);
              }}
            >
              <FilePlus size={14} />
            </button>
            <button
              className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 hover:text-text-primary text-text-tertiary transition-colors border-none bg-transparent cursor-pointer"
              title="New Folder"
              onClick={(e) => {
                e.stopPropagation();
                handleCreateBtnClick(true);
              }}
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable Tree Container */}
        <div className="flex-1 overflow-y-auto py-1 outline-none" tabIndex={-1}>
          {creatingNode?.parentPath === "/" && (
            <InlineInput
              depth={0}
              isFolder={creatingNode.isFolder}
              onSubmit={(name) =>
                handleCreateCommit("/", name, creatingNode.isFolder)
              }
              onCancel={handleCreateCancel}
            />
          )}

          {fileTree.children?.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={0}
              focusedPath={focusedPath}
              setFocusedPath={setFocusedPath}
              onContextMenu={handleContextMenu}
              renamingPath={renamingPath}
              creatingNode={creatingNode}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={handleRenameCancel}
              onCreateCommit={handleCreateCommit}
              onCreateCancel={handleCreateCancel}
            />
          ))}
        </div>

        {/* Context Menu Overlay */}
        {contextMenu &&
          createPortal(
            <div
              className="fixed z-[1200] w-48 bg-bg-secondary border border-border-default rounded shadow-xl py-1 flex flex-col"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="px-3 py-1.5 text-xs text-text-tertiary border-b border-border-subtle mb-1 truncate">
                {contextMenu.node ? contextMenu.node.path : "/"}
              </div>

              {(!contextMenu.node || contextMenu.node.isFolder) && (
                <>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-accent-primary/20 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={() => {
                      setCreatingNode({
                        parentPath: contextMenu.node
                          ? contextMenu.node.path
                          : "/",
                        isFolder: false,
                      });
                      setContextMenu(null);
                    }}
                  >
                    <FilePlus size={14} /> New File
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-accent-primary/20 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={() => {
                      setCreatingNode({
                        parentPath: contextMenu.node
                          ? contextMenu.node.path
                          : "/",
                        isFolder: true,
                      });
                      setContextMenu(null);
                    }}
                  >
                    <FolderPlus size={14} /> New Folder
                  </button>
                  {((!contextMenu.node && clipboard) || contextMenu.node) && (
                    <div className="h-px bg-border-subtle my-1 w-full" />
                  )}
                </>
              )}

              {contextMenu.node && (
                <>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-accent-primary/20 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={() => handleClipboardCmd("cut")}
                  >
                    <Scissors size={14} /> Cut
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-accent-primary/20 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={() => handleClipboardCmd("copy")}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </>
              )}

              {(!contextMenu.node || contextMenu.node.isFolder) &&
                clipboard && (
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-accent-primary/20 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={handlePasteCmd}
                  >
                    <Copy size={14} /> Paste
                  </button>
                )}

              {contextMenu.node && (
                <>
                  <div className="h-px bg-border-subtle my-1 w-full" />
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-accent-primary/20 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={handleRenameStart}
                    disabled={contextMenu.node.path === "/"}
                  >
                    <Edit2 size={14} /> Rename
                  </button>
                  <div className="h-px bg-border-subtle my-1 w-full" />
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#f87171] hover:bg-[#f87171]/10 bg-transparent border-none cursor-pointer w-full text-left"
                    onClick={handleDeleteStart}
                    disabled={contextMenu.node.path === "/"}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              )}
            </div>,
            document.body,
          )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingNode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm shadow-2xl animate-in fade-in duration-200">
          <div className="bg-bg-secondary w-[360px] rounded-xl overflow-hidden shadow-2xl border border-border-default transform transition-all">
            <div className="p-5 flex flex-col gap-3">
              <h3 className="text-[14px] font-semibold text-text-primary m-0 flex items-center gap-2">
                <Trash2 size={16} className="text-[#f87171]" />
                Confirm Deletion
              </h3>
              <p className="text-[13px] text-text-secondary leading-relaxed m-0">
                Are you sure you want to delete{" "}
                <strong>'{deletingNode.name}'</strong>?
                {deletingNode.isFolder &&
                  " All its contents will be permanently lost."}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-3 bg-bg-tertiary border-t border-border-subtle">
              <button
                className="px-4 py-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary bg-transparent rounded border border-transparent hover:border-border-default transition-colors cursor-pointer"
                onClick={() => setDeletingNode(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] rounded transition-colors border-none cursor-pointer shadow-sm"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
