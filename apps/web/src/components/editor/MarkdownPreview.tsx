import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEditorStore } from "../../stores/editor.store";

export function MarkdownPreview({ groupId }: { groupId: string }) {
  const group = useEditorStore((s) => s.groups[groupId]);
  const files = useEditorStore((s) => s.files);

  if (!group || !group.activeFile) return null;

  const content = files.get(group.activeFile)?.content || "";

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
