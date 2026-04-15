import { create } from "zustand";

export interface FileEntry {
  path: string;
  name: string;
  language?: string;
  content?: string;
  isFolder?: boolean;
}

export interface EditorGroup {
  id: string;
  openTabs: string[];
  activeFile: string | null;
  isPreviewMode: boolean;
}

export interface TerminalTab {
  id: string;
  title: string;
}

export interface TerminalGroup {
  id: string;
  terminalIds: string[];
  activeTerminalId: string | null;
}

interface EditorState {
  files: Map<string, FileEntry>;

  // Split view state
  groups: Record<string, EditorGroup>;
  grid: string[][]; // outer = rows, inner = cols
  activeGroupId: string;

  isExplorerOpen: boolean;
  sidebarTab: "files" | "search";
  isTerminalOpen: boolean;
  terminalTabs: Record<string, TerminalTab>;
  terminalGroups: Record<string, TerminalGroup>;
  terminalGrid: string[];
  activeTerminalGroupId: string | null;
  nextTerminalNumber: number;

  // Global Actions
  toggleExplorer: () => void;
  setSidebarTab: (tab: "files" | "search") => void;
  toggleTerminal: () => void;
  openNewTerminal: (groupId?: string) => void;
  closeTerminal: (terminalId: string, groupId?: string) => void;
  setActiveTerminal: (terminalId: string, groupId: string) => void;
  splitTerminalGroup: (groupId?: string) => void;
  moveTerminal: (
    terminalId: string,
    sourceGroupId: string,
    targetGroupId: string,
    splitDirection?: "left" | "right",
  ) => void;
  createNode: (path: string, name: string, isFolder: boolean) => void;
  renameNode: (oldPath: string, newPath: string, newName: string) => void;
  deleteNode: (path: string) => void;

  clipboard: { path: string; type: "copy" | "cut" } | null;
  setClipboard: (path: string | null, type?: "copy" | "cut") => void;
  pasteNode: (targetDir: string) => void;

  // Group-specific Actions
  openFile: (file: FileEntry, groupId?: string) => void;
  closeTab: (path: string, groupId: string) => void;
  setActiveFile: (path: string, groupId: string) => void;
  updateFileContent: (path: string, content: string) => void;
  openPreviewToSide: (groupId: string) => void;

  // Split View Routing
  setActiveGroup: (groupId: string) => void;
  splitPane: (
    path: string,
    direction: "left" | "right" | "top" | "bottom",
    targetGroupId: string,
  ) => void;
  closeGroup: (groupId: string) => void;

  // Search and Replace
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  activeSearchMatch: { path: string; line: number; ts: number } | null;
  setActiveSearchMatch: (path: string, line: number) => void;
  replaceAll: (
    searchQuery: string,
    replaceQuery: string,
    excludedFiles?: Set<string>,
  ) => void;
  replaceNext: (
    searchQuery: string,
    replaceQuery: string,
    excludedFiles?: Set<string>,
  ) => void;
}

/* ——— Dummy project files ——— */
const DUMMY_FILES: FileEntry[] = [
  {
    path: "/src/main.tsx",
    name: "main.tsx",
    language: "typescript",
    content: `import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nconst root = ReactDOM.createRoot(\n  document.getElementById("root") as HTMLElement\n);\n\nroot.render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`,
  },
  {
    path: "/src/App.tsx",
    name: "App.tsx",
    language: "typescript",
    content: `import { useState } from "react";\nimport { Header } from "./components/Header";\nimport { TodoList } from "./components/TodoList";\n\ninterface Todo {\n  id: number;\n  text: string;\n  completed: boolean;\n}\n\nexport default function App() {\n  const [todos, setTodos] = useState<Todo[]>([\n    { id: 1, text: "Build the UI", completed: true },\n    { id: 2, text: "Add dark mode", completed: false },\n    { id: 3, text: "Write tests", completed: false },\n  ]);\n\n  const toggleTodo = (id: number) => {\n    setTodos((prev) =>\n      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))\n    );\n  };\n\n  return (\n    <div className="app">\n      <Header count={todos.filter((t) => !t.completed).length} />\n      <TodoList todos={todos} onToggle={toggleTodo} />\n    </div>\n  );\n}`,
  },
  {
    path: "/src/index.css",
    name: "index.css",
    language: "css",
    content: `:root {\n  --bg-primary: #0a0a0f;\n  --bg-secondary: #12121a;\n  --text-primary: #e4e4e7;\n  --accent: #16a34a;\n}\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: "Inter", sans-serif;\n  background: var(--bg-primary);\n  color: var(--text-primary);\n  min-height: 100vh;\n}\n\n.app {\n  max-width: 640px;\n  margin: 0 auto;\n  padding: 2rem;\n}`,
  },
  {
    path: "/src/components/Header.tsx",
    name: "Header.tsx",
    language: "typescript",
    content: `interface HeaderProps {\n  count: number;\n}\n\nexport function Header({ count }: HeaderProps) {\n  return (\n    <header className="header">\n      <h1>My Todos</h1>\n      <span className="badge">{count} remaining</span>\n    </header>\n  );\n}`,
  },
  {
    path: "/src/components/TodoList.tsx",
    name: "TodoList.tsx",
    language: "typescript",
    content: `interface Todo {\n  id: number;\n  text: string;\n  completed: boolean;\n}\n\ninterface TodoListProps {\n  todos: Todo[];\n  onToggle: (id: number) => void;\n}\n\nexport function TodoList({ todos, onToggle }: TodoListProps) {\n  return (\n    <ul className="todo-list">\n      {todos.map((todo) => (\n        <li\n          key={todo.id}\n          className={\`todo-item \${todo.completed ? "done" : ""}\`}\n          onClick={() => onToggle(todo.id)}\n        >\n          <span className="checkbox">\n            {todo.completed ? "✓" : ""}\n          </span>\n          <span className="text">{todo.text}</span>\n        </li>\n      ))}\n    </ul>\n  );\n}`,
  },
  {
    path: "/package.json",
    name: "package.json",
    language: "json",
    content: `{\n  "name": "my-project",\n  "version": "1.0.0",\n  "private": true,\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^19.2.0",\n    "react-dom": "^19.2.0"\n  },\n  "devDependencies": {\n    "vite": "^7.3.1",\n    "typescript": "~5.9.3"\n  }\n}`,
  },
  {
    path: "/tsconfig.json",
    name: "tsconfig.json",
    language: "json",
    content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "ESNext",\n    "lib": ["ES2020", "DOM", "DOM.Iterable"],\n    "jsx": "react-jsx",\n    "strict": true,\n    "esModuleInterop": true,\n    "skipLibCheck": true,\n    "forceConsistentCasingInFileNames": true,\n    "resolveJsonModule": true,\n    "isolatedModules": true,\n    "noEmit": true\n  },\n  "include": ["src"]\n}`,
  },
  {
    path: "/README.md",
    name: "README.md",
    language: "markdown",
    content: `# My Project\n\nA simple Todo application built with React and TypeScript.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Features\n\n- Add and remove todos\n- Mark todos as complete\n- Dark theme UI\n`,
  },
];

const initialFiles = new Map<string, FileEntry>();
DUMMY_FILES.forEach((f) => initialFiles.set(f.path, f));

const generateId = () => Math.random().toString(36).substring(2, 9);
const MAX_TERMINALS = 6;
const MAX_TERMINAL_GROUPS = 2;

export const useEditorStore = create<EditorState>((set) => ({
  files: initialFiles,

  groups: {
    main: {
      id: "main",
      openTabs: ["/src/main.tsx", "/src/App.tsx", "/README.md"],
      activeFile: "/src/main.tsx",
      isPreviewMode: false,
    },
  },
  grid: [["main"]],
  activeGroupId: "main",

  isExplorerOpen: true,
  sidebarTab: "files",
  isTerminalOpen: true,
  terminalTabs: {
    "term-1": { id: "term-1", title: "Terminal 1" },
  },
  terminalGroups: {
    main: { id: "main", terminalIds: ["term-1"], activeTerminalId: "term-1" },
  },
  terminalGrid: ["main"],
  activeTerminalGroupId: "main",
  nextTerminalNumber: 2,
  clipboard: null,

  setClipboard: (path, type = "copy") =>
    set({ clipboard: path ? { path, type } : null }),

  globalSearchQuery: "",
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  activeSearchMatch: null,
  setActiveSearchMatch: (path, line) =>
    set({ activeSearchMatch: { path, line, ts: Date.now() } }),

  toggleExplorer: () =>
    set((state) => ({
      isExplorerOpen: !state.isExplorerOpen,
      activeSearchMatch: !state.isExplorerOpen ? state.activeSearchMatch : null, // clear on close via toggle
    })),
  setSidebarTab: (tab) =>
    set((state) => ({
      sidebarTab: tab,
      isExplorerOpen: true,
      activeSearchMatch: tab === "search" ? state.activeSearchMatch : null, // clear if tab changes
    })),
  toggleTerminal: () =>
    set((state) => {
      if (state.isTerminalOpen) {
        return { isTerminalOpen: false };
      }

      const existingTerminalCount = Object.keys(state.terminalTabs).length;
      if (existingTerminalCount > 0) {
        return { isTerminalOpen: true };
      }

      const id = `term-${generateId()}`;
      return {
        isTerminalOpen: true,
        terminalTabs: {
          [id]: { id, title: `Terminal ${state.nextTerminalNumber}` },
        },
        terminalGroups: {
          main: { id: "main", terminalIds: [id], activeTerminalId: id },
        },
        terminalGrid: ["main"],
        activeTerminalGroupId: "main",
        nextTerminalNumber: state.nextTerminalNumber + 1,
      };
    }),

  openNewTerminal: (groupId) =>
    set((state) => {
      const total = Object.keys(state.terminalTabs).length;
      if (total >= MAX_TERMINALS) return { isTerminalOpen: true };

      const requestedGroupId =
        groupId ??
        state.activeTerminalGroupId ??
        state.terminalGrid[0] ??
        "main";
      const targetGroupId = state.terminalGroups[requestedGroupId]
        ? requestedGroupId
        : "main";
      const targetGroup = state.terminalGroups[targetGroupId] ?? {
        id: targetGroupId,
        terminalIds: [],
        activeTerminalId: null,
      };

      const id = `term-${generateId()}`;
      return {
        isTerminalOpen: true,
        terminalTabs: {
          ...state.terminalTabs,
          [id]: { id, title: `Terminal ${state.nextTerminalNumber}` },
        },
        terminalGroups: {
          ...state.terminalGroups,
          [targetGroupId]: {
            ...targetGroup,
            terminalIds: [...targetGroup.terminalIds, id],
            activeTerminalId: id,
          },
        },
        terminalGrid: state.terminalGrid.includes(targetGroupId)
          ? state.terminalGrid
          : [...state.terminalGrid, targetGroupId],
        activeTerminalGroupId: targetGroupId,
        nextTerminalNumber: state.nextTerminalNumber + 1,
      };
    }),

  closeTerminal: (terminalId, groupId) =>
    set((state) => {
      const targetGroupId =
        groupId ?? state.activeTerminalGroupId ?? state.terminalGrid[0] ?? null;
      if (!targetGroupId) return state;

      const targetGroup = state.terminalGroups[targetGroupId];
      if (!targetGroup) return state;
      if (!targetGroup.terminalIds.includes(terminalId)) return state;

      const terminalIds = targetGroup.terminalIds.filter(
        (id) => id !== terminalId,
      );
      const idx = targetGroup.terminalIds.indexOf(terminalId);

      const terminalTabs = { ...state.terminalTabs };
      delete terminalTabs[terminalId];

      const terminalGroups = { ...state.terminalGroups };
      const terminalGrid = [...state.terminalGrid];

      if (terminalIds.length === 0) {
        delete terminalGroups[targetGroupId];
        const gridIdx = terminalGrid.indexOf(targetGroupId);
        if (gridIdx !== -1) terminalGrid.splice(gridIdx, 1);
      } else {
        const fallback = terminalIds[Math.max(0, idx - 1)] ?? terminalIds[0];
        terminalGroups[targetGroupId] = {
          ...targetGroup,
          terminalIds,
          activeTerminalId:
            targetGroup.activeTerminalId === terminalId
              ? fallback
              : targetGroup.activeTerminalId,
        };
      }

      const hasAnyTerminals = Object.keys(terminalTabs).length > 0;
      const activeTerminalGroupId = terminalGrid.includes(
        state.activeTerminalGroupId ?? "",
      )
        ? state.activeTerminalGroupId
        : (terminalGrid[0] ?? null);

      return {
        terminalTabs,
        terminalGroups,
        terminalGrid,
        activeTerminalGroupId,
        isTerminalOpen: hasAnyTerminals ? state.isTerminalOpen : false,
      };
    }),

  setActiveTerminal: (terminalId, groupId) =>
    set((state) => {
      const group = state.terminalGroups[groupId];
      if (!group || !group.terminalIds.includes(terminalId)) return state;

      return {
        activeTerminalGroupId: groupId,
        terminalGroups: {
          ...state.terminalGroups,
          [groupId]: {
            ...group,
            activeTerminalId: terminalId,
          },
        },
      };
    }),

  splitTerminalGroup: (groupId) =>
    set((state) => {
      if (state.terminalGrid.length >= MAX_TERMINAL_GROUPS) return state;

      const targetGroupId =
        groupId ?? state.activeTerminalGroupId ?? state.terminalGrid[0] ?? null;
      if (!targetGroupId) return state;

      if (!state.terminalGroups[targetGroupId]) return state;

      const total = Object.keys(state.terminalTabs).length;
      if (total >= MAX_TERMINALS) return state;

      const terminalId = `term-${generateId()}`;
      const newGroupId = `tg-${generateId()}`;

      return {
        isTerminalOpen: true,
        terminalTabs: {
          ...state.terminalTabs,
          [terminalId]: {
            id: terminalId,
            title: `Terminal ${state.nextTerminalNumber}`,
          },
        },
        terminalGroups: {
          ...state.terminalGroups,
          [newGroupId]: {
            id: newGroupId,
            terminalIds: [terminalId],
            activeTerminalId: terminalId,
          },
        },
        terminalGrid: [...state.terminalGrid, newGroupId],
        activeTerminalGroupId: newGroupId,
        nextTerminalNumber: state.nextTerminalNumber + 1,
      };
    }),

  moveTerminal: (terminalId, sourceGroupId, targetGroupId, splitDirection) =>
    set((state) => {
      if (sourceGroupId === targetGroupId && !splitDirection) return state;

      const sourceGroup = state.terminalGroups[sourceGroupId];
      if (!sourceGroup || !sourceGroup.terminalIds.includes(terminalId)) {
        return state;
      }

      const terminalGroups = { ...state.terminalGroups };
      const terminalGrid = [...state.terminalGrid];

      const sourceNextIds = sourceGroup.terminalIds.filter(
        (id) => id !== terminalId,
      );
      if (sourceNextIds.length === 0) {
        delete terminalGroups[sourceGroupId];
        const sourceIdx = terminalGrid.indexOf(sourceGroupId);
        if (sourceIdx !== -1) terminalGrid.splice(sourceIdx, 1);
      } else {
        terminalGroups[sourceGroupId] = {
          ...sourceGroup,
          terminalIds: sourceNextIds,
          activeTerminalId:
            sourceGroup.activeTerminalId === terminalId
              ? (sourceNextIds[
                  Math.max(0, sourceGroup.terminalIds.indexOf(terminalId) - 1)
                ] ?? sourceNextIds[0])
              : sourceGroup.activeTerminalId,
        };
      }

      let finalTargetGroupId = targetGroupId;

      if (splitDirection) {
        if (terminalGrid.length >= MAX_TERMINAL_GROUPS) return state;

        const baseTargetIdx = terminalGrid.indexOf(targetGroupId);
        if (baseTargetIdx === -1) return state;

        const newGroupId = `tg-${generateId()}`;
        terminalGroups[newGroupId] = {
          id: newGroupId,
          terminalIds: [terminalId],
          activeTerminalId: terminalId,
        };

        terminalGrid.splice(
          splitDirection === "left" ? baseTargetIdx : baseTargetIdx + 1,
          0,
          newGroupId,
        );
        finalTargetGroupId = newGroupId;
      } else {
        const targetGroup = terminalGroups[targetGroupId];
        if (!targetGroup) return state;
        terminalGroups[targetGroupId] = {
          ...targetGroup,
          terminalIds: [...targetGroup.terminalIds, terminalId],
          activeTerminalId: terminalId,
        };
      }

      if (splitDirection) {
        const targetGroup = terminalGroups[finalTargetGroupId];
        terminalGroups[finalTargetGroupId] = {
          ...targetGroup,
          terminalIds: [terminalId],
          activeTerminalId: terminalId,
        };
      }

      return {
        terminalGroups,
        terminalGrid,
        activeTerminalGroupId: finalTargetGroupId,
      };
    }),

  setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

  openFile: (file, passedGroupId) =>
    set((state) => {
      const groupId = passedGroupId || state.activeGroupId;
      const group = state.groups[groupId];
      if (!group) return state;

      const newFiles = new Map(state.files);
      newFiles.set(file.path, file);

      const newTabs = group.openTabs.includes(file.path)
        ? group.openTabs
        : [...group.openTabs, file.path];

      return {
        files: newFiles,
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            openTabs: newTabs,
            activeFile: file.path,
            isPreviewMode: false,
          },
        },
        activeGroupId: groupId,
      };
    }),

  closeTab: (path, groupId) =>
    set((state) => {
      const group = state.groups[groupId];
      if (!group) return state;

      const newTabs = group.openTabs.filter((t) => t !== path);

      if (newTabs.length === 0) {
        const isOnlyGroup =
          state.grid.length === 1 && state.grid[0].length === 1;
        if (isOnlyGroup) {
          return {
            groups: {
              ...state.groups,
              [groupId]: { ...group, openTabs: [], activeFile: null },
            },
          };
        } else {
          const newGrid = state.grid
            .map((row) => row.filter((id) => id !== groupId))
            .filter((row) => row.length > 0);
          const newGroups = { ...state.groups };
          delete newGroups[groupId];

          let newActiveGroupId = state.activeGroupId;
          if (newActiveGroupId === groupId) {
            newActiveGroupId = newGrid[0]?.[newGrid[0].length - 1]; // Pick last in first row as default
          }

          return {
            grid: newGrid,
            groups: newGroups,
            activeGroupId: newActiveGroupId,
          };
        }
      }

      let newActive = group.activeFile;
      if (group.activeFile === path) {
        const idx = group.openTabs.indexOf(path);
        newActive = newTabs[Math.min(idx, newTabs.length - 1)] || null;
      }
      return {
        groups: {
          ...state.groups,
          [groupId]: { ...group, openTabs: newTabs, activeFile: newActive },
        },
      };
    }),

  closeGroup: (groupId) =>
    set((state) => {
      const isOnlyGroup = state.grid.length === 1 && state.grid[0].length === 1;
      if (isOnlyGroup) return state;

      const newGrid = state.grid
        .map((row) => row.filter((id) => id !== groupId))
        .filter((row) => row.length > 0);
      const newGroups = { ...state.groups };
      delete newGroups[groupId];

      let newActiveGroupId = state.activeGroupId;
      if (newActiveGroupId === groupId) {
        newActiveGroupId = newGrid[0]?.[newGrid[0].length - 1];
      }

      return {
        grid: newGrid,
        groups: newGroups,
        activeGroupId: newActiveGroupId,
      };
    }),

  setActiveFile: (path, groupId) =>
    set((state) => {
      const group = state.groups[groupId];
      if (!group) return state;
      return {
        groups: {
          ...state.groups,
          [groupId]: { ...group, activeFile: path, isPreviewMode: false },
        },
        activeGroupId: groupId,
      };
    }),

  updateFileContent: (path, content) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(path);
      if (file) {
        newFiles.set(path, { ...file, content });
      }
      return { files: newFiles };
    }),

  openPreviewToSide: (groupId) =>
    set((state) => {
      const group = state.groups[groupId];
      if (!group || !group.activeFile || !group.activeFile.endsWith(".md"))
        return state;

      const path = group.activeFile;

      const newGroups: Record<string, EditorGroup> = { ...state.groups };
      const newGrid = state.grid.map((row) => [...row]);

      const removeGroupFromGrid = (gid: string) => {
        for (let i = newGrid.length - 1; i >= 0; i--) {
          newGrid[i] = newGrid[i].filter((id) => id !== gid);
          if (newGrid[i].length === 0) newGrid.splice(i, 1);
        }
      };

      const isOnlyGroup = () => newGrid.length === 1 && newGrid[0].length === 1;

      const closePreviewGroup = (previewGroup: EditorGroup) => {
        if (!newGroups[previewGroup.id]) return;
        if (previewGroup.id === groupId || isOnlyGroup()) {
          newGroups[previewGroup.id] = {
            ...newGroups[previewGroup.id],
            isPreviewMode: false,
          };
        } else {
          delete newGroups[previewGroup.id];
          removeGroupFromGrid(previewGroup.id);
        }
      };

      const allPreviewGroups = Object.values(newGroups).filter(
        (g) => g.isPreviewMode,
      );
      const previewGroupsForPath = allPreviewGroups.filter(
        (g) => g.activeFile === path,
      );

      // Toggle behavior: if preview for this file exists, close it.
      if (previewGroupsForPath.length > 0) {
        allPreviewGroups.forEach(closePreviewGroup);
        const fallbackActive = newGroups[groupId]
          ? groupId
          : newGrid[0]?.[newGrid[0].length - 1] || state.activeGroupId;

        return {
          groups: newGroups,
          grid: newGrid.length > 0 ? newGrid : state.grid,
          activeGroupId: fallbackActive,
        };
      }

      // Enforce single preview globally: close any existing preview first.
      allPreviewGroups.forEach(closePreviewGroup);

      // Find current pos
      let r = -1,
        c = -1;
      for (let i = 0; i < newGrid.length; i++) {
        const idx = newGrid[i].indexOf(groupId);
        if (idx !== -1) {
          r = i;
          c = idx;
          break;
        }
      }
      if (r === -1) return state;

      // Default right split
      let direction = "right";
      if (newGrid[r].length >= 3) direction = "bottom";

      // If matrix is full, fallback to inline preview mode in the same pane.
      if (direction === "bottom" && newGrid.length >= 2) {
        return {
          groups: {
            ...newGroups,
            [groupId]: { ...newGroups[groupId], isPreviewMode: true },
          },
          grid: newGrid,
          activeGroupId: groupId,
        };
      }

      const newGroupId = "g-" + generateId();
      const newGroup: EditorGroup = {
        id: newGroupId,
        openTabs: [path],
        activeFile: path,
        isPreviewMode: true,
      };

      if (direction === "right") {
        newGrid[r].splice(c + 1, 0, newGroupId);
      } else {
        newGrid.splice(r + 1, 0, [newGroupId]);
      }

      // Keep source group untouched except ensure its own preview mode is off since we split
      return {
        groups: {
          ...newGroups,
          [groupId]: { ...newGroups[groupId], isPreviewMode: false },
          [newGroupId]: newGroup,
        },
        grid: newGrid,
        activeGroupId: newGroupId,
      };
    }),

  splitPane: (path, direction, targetGroupId) =>
    set((state) => {
      let r = -1,
        c = -1;
      for (let i = 0; i < state.grid.length; i++) {
        const idx = state.grid[i].indexOf(targetGroupId);
        if (idx !== -1) {
          r = i;
          c = idx;
          break;
        }
      }
      if (r === -1) return state;

      const newGroupId = "g-" + generateId();
      const newGroup: EditorGroup = {
        id: newGroupId,
        openTabs: [path],
        activeFile: path,
        isPreviewMode: false,
      };

      const newGrid = [...state.grid.map((row) => [...row])];

      if (direction === "left" || direction === "right") {
        if (newGrid[r].length >= 3) return state; // Constraint: max 3 horizontal slots
        const insertIdx = direction === "left" ? c : c + 1;
        newGrid[r].splice(insertIdx, 0, newGroupId);
      } else if (direction === "top" || direction === "bottom") {
        if (newGrid.length >= 2) return state; // Constraint: max 2 vertical slots (rows)
        const insertIdx = direction === "top" ? r : r + 1;
        newGrid.splice(insertIdx, 0, [newGroupId]);
      }

      return {
        groups: {
          ...state.groups,
          [newGroupId]: newGroup,
        },
        grid: newGrid,
        activeGroupId: newGroupId,
      };
    }),

  // Filesystem actions -> They modify all groups iteratively!
  createNode: (path, name, isFolder) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const ext = name.split(".").pop()?.toLowerCase() || "plaintext";
      newFiles.set(path, {
        path,
        name,
        isFolder,
        language: isFolder ? undefined : ext,
        content: isFolder ? undefined : "",
      });
      return { files: newFiles };
    }),

  renameNode: (oldPath, newPath, newName) =>
    set((state) => {
      const newFiles = new Map(state.files);

      [...newFiles.entries()].forEach(([k, file]) => {
        if (k === oldPath) {
          newFiles.delete(k);
          newFiles.set(newPath, { ...file, path: newPath, name: newName });
        } else if (k.startsWith(oldPath + "/")) {
          newFiles.delete(k);
          const renamedPath = k.replace(oldPath, newPath);
          newFiles.set(renamedPath, { ...file, path: renamedPath });
        }
      });

      // Update paths inside ALL groups
      const newGroups = { ...state.groups };
      Object.keys(newGroups).forEach((gid) => {
        const group = newGroups[gid];
        const newTabs = group.openTabs.map((t) => {
          if (t === oldPath) return newPath;
          if (t.startsWith(oldPath + "/")) return t.replace(oldPath, newPath);
          return t;
        });

        let newActive = group.activeFile;
        if (newActive === oldPath) newActive = newPath;
        else if (newActive?.startsWith(oldPath + "/"))
          newActive = newActive.replace(oldPath, newPath);

        newGroups[gid] = { ...group, openTabs: newTabs, activeFile: newActive };
      });

      return { files: newFiles, groups: newGroups };
    }),

  deleteNode: (path) =>
    set((state) => {
      const newFiles = new Map(state.files);

      [...newFiles.keys()].forEach((k) => {
        if (k === path || k.startsWith(path + "/")) {
          newFiles.delete(k);
        }
      });

      const newGroups = { ...state.groups };
      Object.keys(newGroups).forEach((gid) => {
        const group = newGroups[gid];
        const filteredTabs = group.openTabs.filter(
          (t) => t !== path && !t.startsWith(path + "/"),
        );

        let newActive = group.activeFile;
        if (!filteredTabs.includes(newActive as string)) {
          newActive =
            filteredTabs.length > 0
              ? filteredTabs[filteredTabs.length - 1]
              : null;
        }

        newGroups[gid] = {
          ...group,
          openTabs: filteredTabs,
          activeFile: newActive,
        };
      });

      return { files: newFiles, groups: newGroups };
    }),

  pasteNode: (targetDir: string) =>
    set((state) => {
      if (!state.clipboard) return state;
      const { path: sourcePath, type } = state.clipboard;
      const targetPath = targetDir === "/" ? "" : targetDir;
      const sourceName = sourcePath.split("/").pop() || "";
      let newPath = `${targetPath}/${sourceName}`;

      const newFiles = new Map(state.files);

      // Prevent pasting into itself
      if (targetDir === sourcePath || targetDir.startsWith(sourcePath + "/")) {
        return state;
      }

      // Handle duplicate names on paste
      if (newFiles.has(newPath)) {
        if (type === "cut") return state; // Don't allow cutting over existing files immediately
        const nameBase = sourceName.includes(".")
          ? sourceName.split(".").slice(0, -1).join(".")
          : sourceName;
        const ext = sourceName.includes(".")
          ? "." + sourceName.split(".").pop()
          : "";
        newPath = `${targetPath}/${nameBase}-copy${ext}`;
      }

      if (type === "cut") {
        [...newFiles.entries()].forEach(([k, file]) => {
          if (k === sourcePath) {
            newFiles.delete(k);
            newFiles.set(newPath, {
              ...file,
              path: newPath,
              name: newPath.split("/").pop()!,
            });
          } else if (k.startsWith(sourcePath + "/")) {
            newFiles.delete(k);
            const renamedPath = k.replace(sourcePath, newPath);
            newFiles.set(renamedPath, {
              ...file,
              path: renamedPath,
              name: renamedPath.split("/").pop()!,
            });
          }
        });

        const newGroups = { ...state.groups };
        Object.keys(newGroups).forEach((gid) => {
          const group = newGroups[gid];
          const newTabs = group.openTabs.map((t) => {
            if (t === sourcePath) return newPath;
            if (t.startsWith(sourcePath + "/"))
              return t.replace(sourcePath, newPath);
            return t;
          });
          let newActive = group.activeFile;
          if (newActive === sourcePath) newActive = newPath;
          else if (newActive?.startsWith(sourcePath + "/"))
            newActive = newActive.replace(sourcePath, newPath);
          newGroups[gid] = {
            ...group,
            openTabs: newTabs,
            activeFile: newActive,
          };
        });

        return { files: newFiles, groups: newGroups, clipboard: null };
      } else {
        const sourceFile = state.files.get(sourcePath);
        if (sourceFile && !sourceFile.isFolder) {
          newFiles.set(newPath, {
            ...sourceFile,
            path: newPath,
            name: newPath.split("/").pop()!,
          });
        } else {
          [...state.files.entries()].forEach(([k, file]) => {
            if (k === sourcePath || k.startsWith(sourcePath + "/")) {
              const replacedPath = k.replace(sourcePath, newPath);
              newFiles.set(replacedPath, {
                ...file,
                path: replacedPath,
                name: replacedPath.split("/").pop()!,
              });
            }
          });
        }
        return { files: newFiles };
      }
    }),

  replaceAll: (searchQuery, replaceQuery, excludedFiles = new Set()) =>
    set((state) => {
      if (!searchQuery) return state;
      const newFiles = new Map(state.files);

      [...newFiles.entries()].forEach(([k, file]) => {
        if (
          !file.isFolder &&
          file.content &&
          file.content.includes(searchQuery) &&
          !excludedFiles.has(k)
        ) {
          newFiles.set(k, {
            ...file,
            content: file.content.split(searchQuery).join(replaceQuery),
          });
        }
      });
      return { files: newFiles };
    }),

  replaceNext: (searchQuery, replaceQuery, excludedFiles = new Set()) =>
    set((state) => {
      if (!searchQuery) return state;
      const newFiles = new Map(state.files);

      // Find the first file that contains the search query and replace its first instance
      for (const [k, file] of newFiles) {
        if (
          !file.isFolder &&
          file.content &&
          file.content.includes(searchQuery) &&
          !excludedFiles.has(k)
        ) {
          newFiles.set(k, {
            ...file,
            content: file.content.replace(searchQuery, replaceQuery),
          });
          break; // Only replace one total instance across all files, then break
        }
      }
      return { files: newFiles };
    }),
}));

export { DUMMY_FILES };
