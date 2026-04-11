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

interface EditorState {
  files: Map<string, FileEntry>;
  
  // Split view state
  groups: Record<string, EditorGroup>;
  grid: string[][]; // outer = rows, inner = cols
  activeGroupId: string;

  isExplorerOpen: boolean;
  sidebarTab: 'files' | 'search';
  isTerminalOpen: boolean;

  // Global Actions
  toggleExplorer: () => void;
  setSidebarTab: (tab: 'files' | 'search') => void;
  toggleTerminal: () => void;
  createNode: (path: string, name: string, isFolder: boolean) => void;
  renameNode: (oldPath: string, newPath: string, newName: string) => void;
  deleteNode: (path: string) => void;

  // Group-specific Actions
  openFile: (file: FileEntry, groupId?: string) => void;
  closeTab: (path: string, groupId: string) => void;
  setActiveFile: (path: string, groupId: string) => void;
  updateFileContent: (path: string, content: string) => void;
  openPreviewToSide: (groupId: string) => void;
  
  // Split View Routing
  setActiveGroup: (groupId: string) => void;
  splitPane: (path: string, direction: "left" | "right" | "top" | "bottom", targetGroupId: string) => void;
  closeGroup: (groupId: string) => void;

  // Search and Replace
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  activeSearchMatch: { path: string; line: number; ts: number } | null;
  setActiveSearchMatch: (path: string, line: number) => void;
  replaceAll: (searchQuery: string, replaceQuery: string) => void;
  replaceNext: (searchQuery: string, replaceQuery: string) => void;
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

export const useEditorStore = create<EditorState>((set, get) => ({
  files: initialFiles,
  
  groups: {
    "main": {
      id: "main",
      openTabs: ["/src/main.tsx", "/src/App.tsx", "/README.md"],
      activeFile: "/src/main.tsx",
      isPreviewMode: false,
    }
  },
  grid: [["main"]],
  activeGroupId: "main",

  isExplorerOpen: true,
  sidebarTab: "files",
  isTerminalOpen: true,

  globalSearchQuery: "",
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  activeSearchMatch: null,
  setActiveSearchMatch: (path, line) => set({ activeSearchMatch: { path, line, ts: Date.now() } }),

  toggleExplorer: () => set((state) => ({ 
     isExplorerOpen: !state.isExplorerOpen,
     activeSearchMatch: (!state.isExplorerOpen) ? state.activeSearchMatch : null // clear on close via toggle
  })),
  setSidebarTab: (tab) => set((state) => ({ 
     sidebarTab: tab, 
     isExplorerOpen: true,
     activeSearchMatch: tab === "search" ? state.activeSearchMatch : null // clear if tab changes
  })),
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),

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
          [groupId]: { ...group, openTabs: newTabs, activeFile: file.path, isPreviewMode: false }
        },
        activeGroupId: groupId
      };
    }),

  closeTab: (path, groupId) =>
    set((state) => {
      const group = state.groups[groupId];
      if (!group) return state;

      const newTabs = group.openTabs.filter((t) => t !== path);
      
      if (newTabs.length === 0) {
        const isOnlyGroup = state.grid.length === 1 && state.grid[0].length === 1;
        if (isOnlyGroup) {
           return {
             groups: {
               ...state.groups,
               [groupId]: { ...group, openTabs: [], activeFile: null }
             }
           };
        } else {
           const newGrid = state.grid.map(row => row.filter(id => id !== groupId)).filter(row => row.length > 0);
           const newGroups = { ...state.groups };
           delete newGroups[groupId];

           let newActiveGroupId = state.activeGroupId;
           if (newActiveGroupId === groupId) {
              newActiveGroupId = newGrid[0]?.[newGrid[0].length - 1]; // Pick last in first row as default
           }

           return {
              grid: newGrid,
              groups: newGroups,
              activeGroupId: newActiveGroupId
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
          [groupId]: { ...group, openTabs: newTabs, activeFile: newActive }
        }
      };
    }),

  closeGroup: (groupId) => 
    set((state) => {
      const isOnlyGroup = state.grid.length === 1 && state.grid[0].length === 1;
      if (isOnlyGroup) return state;

      const newGrid = state.grid.map(row => row.filter(id => id !== groupId)).filter(row => row.length > 0);
      const newGroups = { ...state.groups };
      delete newGroups[groupId];

      let newActiveGroupId = state.activeGroupId;
      if (newActiveGroupId === groupId) {
         newActiveGroupId = newGrid[0]?.[newGrid[0].length - 1];
      }

      return {
         grid: newGrid,
         groups: newGroups,
         activeGroupId: newActiveGroupId
      };
    }),

  setActiveFile: (path, groupId) => set((state) => {
    const group = state.groups[groupId];
    if (!group) return state;
    return {
      groups: {
        ...state.groups,
        [groupId]: { ...group, activeFile: path, isPreviewMode: false }
      },
      activeGroupId: groupId
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

  openPreviewToSide: (groupId) => set((state) => {
    const group = state.groups[groupId];
    if (!group || !group.activeFile || !group.activeFile.endsWith(".md")) return state;
    
    const path = group.activeFile;

    // Find current pos
    let r = -1, c = -1;
    for (let i = 0; i < state.grid.length; i++) {
      const idx = state.grid[i].indexOf(groupId);
      if (idx !== -1) {
         r = i;
         c = idx;
         break;
      }
    }
    if (r === -1) return state;

    // Default right split
    let direction = "right";
    if (state.grid[r].length >= 3) direction = "bottom"; 
    // Edge case if 3x2 exactly, we ignore the side split requirement if forced
    if (direction === "bottom" && state.grid.length >= 2) return state; // Matrix is full

    const newGroupId = "g-" + generateId();
    const newGroup: EditorGroup = {
       id: newGroupId,
       openTabs: [path],
       activeFile: path,
       isPreviewMode: true 
    };
    
    const newGrid = [...state.grid.map(row => [...row])];
    if (direction === "right") {
       newGrid[r].splice(c + 1, 0, newGroupId);
    } else {
       newGrid.splice(r + 1, 0, [newGroupId]);
    }

    // Keep source group untouched except ensure its own preview mode is off since we split
    return {
       groups: {
         ...state.groups,
         [groupId]: { ...state.groups[groupId], isPreviewMode: false },
         [newGroupId]: newGroup
       },
       grid: newGrid,
       activeGroupId: newGroupId
    };
  }),

  splitPane: (path, direction, targetGroupId) => set((state) => {
     let r = -1, c = -1;
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
        isPreviewMode: false
     };

     const newGrid = [...state.grid.map(row => [...row])];

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
           [newGroupId]: newGroup
        },
        grid: newGrid,
        activeGroupId: newGroupId
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
      Object.keys(newGroups).forEach(gid => {
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
      Object.keys(newGroups).forEach(gid => {
         const group = newGroups[gid];
         const filteredTabs = group.openTabs.filter(
            (t) => t !== path && !t.startsWith(path + "/")
         );
         
         let newActive = group.activeFile;
         if (!filteredTabs.includes(newActive as string)) {
             newActive = filteredTabs.length > 0 ? filteredTabs[filteredTabs.length - 1] : null;
         }

         newGroups[gid] = { ...group, openTabs: filteredTabs, activeFile: newActive };
      });

      return { files: newFiles, groups: newGroups };
    }),

  replaceAll: (searchQuery, replaceQuery) =>
    set((state) => {
      if (!searchQuery) return state;
      const newFiles = new Map(state.files);

      [...newFiles.entries()].forEach(([k, file]) => {
        if (!file.isFolder && file.content && file.content.includes(searchQuery)) {
           newFiles.set(k, { ...file, content: file.content.split(searchQuery).join(replaceQuery) });
        }
      });
      return { files: newFiles };
    }),

  replaceNext: (searchQuery, replaceQuery) => 
    set((state) => {
      if (!searchQuery) return state;
      const newFiles = new Map(state.files);
      
      // Find the first file that contains the search query and replace its first instance
      for (const [k, file] of newFiles) {
         if (!file.isFolder && file.content && file.content.includes(searchQuery)) {
            newFiles.set(k, { ...file, content: file.content.replace(searchQuery, replaceQuery) });
            break; // Only replace one total instance across all files, then break
         }
      }
      return { files: newFiles };
    }),
}));

export { DUMMY_FILES };
