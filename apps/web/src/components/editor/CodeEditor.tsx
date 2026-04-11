import Editor from "@monaco-editor/react";
import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editor.store";
import { Loader2 } from "lucide-react";

export function CodeEditor({ groupId }: { groupId: string }) {
  const group = useEditorStore((s) => s.groups[groupId]);
  const files = useEditorStore((s) => s.files);
  const updateFileContent = useEditorStore((s) => s.updateFileContent);
  const globalSearchQuery = useEditorStore((s) => s.globalSearchQuery);
  const activeSearchMatch = useEditorStore((s) => s.activeSearchMatch);
  const sidebarTab = useEditorStore((s) => s.sidebarTab);
  const isExplorerOpen = useEditorStore((s) => s.isExplorerOpen);

  const [editorMountCount, setEditorMountCount] = useState(0);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const searchDecorationsRef = useRef<string[]>([]);
  const flashDecorationsRef = useRef<string[]>([]);

  const file = group && group.activeFile ? files.get(group.activeFile) : null;

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMountCount((c) => c + 1);
  };

  useEffect(() => {
    if (!editorMountCount || !editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    let timeoutId: any;

    const updateDecorations = () => {
      if (!globalSearchQuery || !isExplorerOpen || sidebarTab !== "search") {
        searchDecorationsRef.current = editor.deltaDecorations(searchDecorationsRef.current, []);
        return;
      }

      const matches = model.findMatches(globalSearchQuery, false, false, false, null, false);
      const decorations = matches.map((match: any) => ({
        range: match.range,
        options: {
          className: 'search-match-highlight',
          inlineClassName: 'search-match-highlight',
          overviewRuler: {
            color: 'rgba(234, 179, 8, 0.4)',
            position: monaco.editor.OverviewRulerLane.Right
          }
        }
      }));
      searchDecorationsRef.current = editor.deltaDecorations(searchDecorationsRef.current, decorations);
    };

    updateDecorations();
    timeoutId = setTimeout(updateDecorations, 100);

    const disposable = model.onDidChangeContent(() => {
      updateDecorations();
    });

    return () => {
      clearTimeout(timeoutId);
      disposable.dispose();
      // Also clear decorators gracefully on unmount of the effect
      if (editorRef.current) {
        searchDecorationsRef.current = editorRef.current.deltaDecorations(searchDecorationsRef.current, []);
      }
    };
  }, [globalSearchQuery, editorMountCount, sidebarTab, isExplorerOpen]);

  useEffect(() => {
    if (!editorMountCount || !editorRef.current || !monacoRef.current || !file) return;
    
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    if (activeSearchMatch && activeSearchMatch.path === file.path) {
      editor.revealLineInCenter(activeSearchMatch.line);
      
      const flashDecs = [{
        range: new monaco.Range(activeSearchMatch.line, 1, activeSearchMatch.line, 1),
        options: {
          isWholeLine: true,
          className: 'line-flash-highlight'
        }
      }];
      flashDecorationsRef.current = editor.deltaDecorations(flashDecorationsRef.current, flashDecs);
    } else {
      flashDecorationsRef.current = editor.deltaDecorations(flashDecorationsRef.current, []);
    }
  }, [activeSearchMatch, file?.path, editorMountCount]);

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
