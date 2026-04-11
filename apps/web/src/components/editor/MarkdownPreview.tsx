import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEditorStore } from "../../stores/editor.store";

export function MarkdownPreview() {
  const activeFile = useEditorStore((s) => s.activeFile);
  const files = useEditorStore((s) => s.files);
  const content = activeFile ? files.get(activeFile)?.content || "" : "";

  return (
    <div className="absolute inset-0 overflow-y-auto px-8 py-6 bg-bg-primary">
      <div className="max-w-3xl mx-auto prose prose-invert prose-sm pb-12">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
