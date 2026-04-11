import Editor from "@monaco-editor/react";
import { useEditorStore } from "../../stores/editor.store";
import { Loader2 } from "lucide-react";

export function CodeEditor() {
  const activeFile = useEditorStore((s) => s.activeFile);
  const files = useEditorStore((s) => s.files);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);

  const file = activeFile ? files.get(activeFile) : null;

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-2 text-text-tertiary">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-20"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <p className="text-sm font-medium">No file selected</p>
          <p className="text-xs opacity-60">
            Open a file from the explorer to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <Editor
        key={file.path}
        height="100%"
        language={file.language}
        value={file.content}
        theme="vs-dark"
        onChange={(value) => {
          if (value !== undefined) {
            updateFileContent(file.path, value);
          }
        }}
        loading={
          <div className="flex items-center justify-center h-full text-accent-primary">
            <Loader2 className="animate-spin" size={24} />
          </div>
        }
        options={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          lineHeight: 22,
          minimap: { enabled: false },
          scrollBeyondLastLine: true,
          padding: { top: 12 },
          renderLineHighlight: "all",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          bracketPairColorization: { enabled: true },
          wordWrap: "off",
          automaticLayout: true,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
        }}
      />
    </div>
  );
}
