import { create } from "zustand";

export interface FileEntry {
  path: string;
  name: string;
  language: string;
  content: string;
}

interface EditorState {
  files: Map<string, FileEntry>;
  openTabs: string[];
  activeFile: string | null;
  isExplorerOpen: boolean;
  isTerminalOpen: boolean;

  openFile: (file: FileEntry) => void;
  closeTab: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  toggleExplorer: () => void;
  toggleTerminal: () => void;
}

/* ——— Dummy project files ——— */
const DUMMY_FILES: FileEntry[] = [
  {
    path: "/src/main.tsx",
    name: "main.tsx",
    language: "typescript",
    content: `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
  },
  {
    path: "/src/App.tsx",
    name: "App.tsx",
    language: "typescript",
    content: `import { useState } from "react";
import { Header } from "./components/Header";
import { TodoList } from "./components/TodoList";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: "Build the UI", completed: true },
    { id: 2, text: "Add dark mode", completed: false },
    { id: 3, text: "Write tests", completed: false },
  ]);

  const toggleTodo = (id: number) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  return (
    <div className="app">
      <Header count={todos.filter((t) => !t.completed).length} />
      <TodoList todos={todos} onToggle={toggleTodo} />
    </div>
  );
}`,
  },
  {
    path: "/src/index.css",
    name: "index.css",
    language: "css",
    content: `:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --text-primary: #e4e4e7;
  --accent: #16a34a;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "Inter", sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
}

.app {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem;
}`,
  },
  {
    path: "/src/components/Header.tsx",
    name: "Header.tsx",
    language: "typescript",
    content: `interface HeaderProps {
  count: number;
}

export function Header({ count }: HeaderProps) {
  return (
    <header className="header">
      <h1>My Todos</h1>
      <span className="badge">{count} remaining</span>
    </header>
  );
}`,
  },
  {
    path: "/src/components/TodoList.tsx",
    name: "TodoList.tsx",
    language: "typescript",
    content: `interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: number) => void;
}

export function TodoList({ todos, onToggle }: TodoListProps) {
  return (
    <ul className="todo-list">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className={\`todo-item \${todo.completed ? "done" : ""}\`}
          onClick={() => onToggle(todo.id)}
        >
          <span className="checkbox">
            {todo.completed ? "✓" : ""}
          </span>
          <span className="text">{todo.text}</span>
        </li>
      ))}
    </ul>
  );
}`,
  },
  {
    path: "/package.json",
    name: "package.json",
    language: "json",
    content: `{
  "name": "my-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "vite": "^7.3.1",
    "typescript": "~5.9.3"
  }
}`,
  },
  {
    path: "/tsconfig.json",
    name: "tsconfig.json",
    language: "json",
    content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}`,
  },
  {
    path: "/README.md",
    name: "README.md",
    language: "markdown",
    content: `# My Project

A simple Todo application built with React and TypeScript.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- Add and remove todos
- Mark todos as complete
- Dark theme UI
`,
  },
];

const initialFiles = new Map<string, FileEntry>();
DUMMY_FILES.forEach((f) => initialFiles.set(f.path, f));

export const useEditorStore = create<EditorState>((set) => ({
  files: initialFiles,
  openTabs: ["/src/main.tsx", "/src/App.tsx"],
  activeFile: "/src/main.tsx",
  isExplorerOpen: true,
  isTerminalOpen: true,

  openFile: (file) =>
    set((state) => {
      const newFiles = new Map(state.files);
      newFiles.set(file.path, file);
      const newTabs = state.openTabs.includes(file.path)
        ? state.openTabs
        : [...state.openTabs, file.path];
      return { files: newFiles, openTabs: newTabs, activeFile: file.path };
    }),

  closeTab: (path) =>
    set((state) => {
      const newTabs = state.openTabs.filter((t) => t !== path);
      let newActive = state.activeFile;
      if (state.activeFile === path) {
        const idx = state.openTabs.indexOf(path);
        newActive = newTabs[Math.min(idx, newTabs.length - 1)] || null;
      }
      return { openTabs: newTabs, activeFile: newActive };
    }),

  setActiveFile: (path) => set({ activeFile: path }),

  updateFileContent: (path, content) =>
    set((state) => {
      const newFiles = new Map(state.files);
      const file = newFiles.get(path);
      if (file) {
        newFiles.set(path, { ...file, content });
      }
      return { files: newFiles };
    }),

  toggleExplorer: () => set((state) => ({ isExplorerOpen: !state.isExplorerOpen })),
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
}));

export { DUMMY_FILES };
