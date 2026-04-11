import Editor from "@monaco-editor/react";
import { useRef, useEffect } from "react";
import { useEditorStore } from "../../stores/editor.store";
import { Loader2 } from "lucide-react";

export function CodeEditor({ groupId }: { groupId: string }) {
  const group = useEditorStore((s) => s.groups[groupId]);
  const files = useEditorStore((s) => s.files);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const globalSearchQuery = useEditorStore((s) => s.globalSearchQuery);
  const flashLine = useEditorStore((s) => s.flashLine);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const searchDecorationsRef = useRef<any>(null);
  const flashDecorationsRef = useRef<any>(null);

  const file = group && group.activeFile ? files.get(group.activeFile) : null;

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    
    if (!searchDecorationsRef.current) {
      searchDecorationsRef.current = editor.createDecorationsCollection();
    }
    
    if (!globalSearchQuery || !file?.content) {
      searchDecorationsRef.current.set([]);
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    const matches = model.findMatches(globalSearchQuery, false, false, false, null, true);
    const decorations = matches.map((match: any) => ({
      range: match.range,
      options: {
        inlineClassName: 'search-match-highlight',
        overviewRuler: {
          color: 'rgba(234, 179, 8, 0.4)',
          position: monaco.editor.OverviewRulerLane.Right
        }
      }
    }));
    searchDecorationsRef.current.set(decorations);
  }, [globalSearchQuery, file?.content, file?.path]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !flashLine || !file) return;
    
    if (flashLine.path === file.path) {
      const editor = editorRef.current;
      const monaco = monacoRef.current;

      editor.revealLineInCenter(flashLine.line);

      if (!flashDecorationsRef.current) {
        flashDecorationsRef.current = editor.createDecorationsCollection();
      }

      flashDecorationsRef.current.set([{
        range: new monaco.Range(flashLine.line, 1, flashLine.line, 1),
        options: {
          isWholeLine: true,
          className: 'line-flash-highlight'
        }
      }]);

      const timeout = setTimeout(() => {
        if (flashDecorationsRef.current) {
          flashDecorationsRef.current.set([]);
        }
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [flashLine, file?.path]);

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
    <div className="flex-1 min-h-0 overflow-hidden relative">
      <Editor
        key={file.path + groupId}
        height="100%"
        language={file.language}
        value={file.content}
        theme="vs-dark"
        onMount={handleEditorMount}
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
