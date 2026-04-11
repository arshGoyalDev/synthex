import { useState, useRef, useEffect } from "react";
import { ChevronUp, X, TerminalSquare } from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";

const DUMMY_OUTPUT = [
  { type: "info", text: "$ npm install" },
  { type: "output", text: "added 237 packages in 4.2s" },
  { type: "info", text: "$ npm run dev" },
  { type: "output", text: "" },
  {
    type: "success",
    text: "  VITE v7.3.1  ready in 312 ms",
  },
  { type: "output", text: "" },
  { type: "output", text: "  ➜  Local:   http://localhost:5173/" },
  { type: "output", text: "  ➜  Network: http://192.168.1.42:5173/" },
  { type: "output", text: "  ➜  press h + enter to show help" },
];

const lineColors: Record<string, string> = {
  info: "text-zinc-400",
  output: "text-zinc-300",
  success: "text-green-400",
  error: "text-red-400",
};

export function Terminal() {
  const [inputValue, setInputValue] = useState("");
  const [lines, setLines] = useState(DUMMY_OUTPUT);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const isTerminalOpen = useEditorStore((s) => s.isTerminalOpen);
  const toggleTerminal = useEditorStore((s) => s.toggleTerminal);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setLines((prev) => [
      ...prev,
      { type: "info", text: `$ ${inputValue}` },
      {
        type: "output",
        text: `zsh: command not found: ${inputValue.split(" ")[0]}`,
      },
    ]);
    setInputValue("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#1a1a24]">
      {/* Terminal header */}
      <div 
        className="flex items-center justify-between px-3 h-8 bg-bg-secondary shrink-0 select-none cursor-pointer hover:bg-bg-tertiary transition-colors"
        onClick={toggleTerminal}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
          <TerminalSquare size={13} />
          <span>Terminal</span>
        </div>
        <button className="flex items-center justify-center w-5 h-5 rounded border-none bg-transparent text-text-tertiary hover:bg-white/10 hover:text-text-primary transition-colors cursor-pointer">
          {isTerminalOpen ? <X size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Terminal body */}
      {isTerminalOpen && (
        <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto px-3.5 py-2 font-mono text-[13px] leading-relaxed"
          ref={outputRef}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap break-all ${lineColors[line.type] ?? "text-zinc-300"}`}
            >
              {line.text}
            </div>
          ))}
        </div>
        <form
          className="flex items-center gap-1.5 px-3.5 py-1 pb-2 font-mono text-[13px] shrink-0"
          onSubmit={handleSubmit}
        >
          <span className="flex gap-1 shrink-0">
            <span className="text-green-400">➜</span>
            <span className="text-blue-400">~</span>
          </span>
          <input
            className="flex-1 bg-transparent border-none outline-none text-text-primary font-mono text-[13px] caret-green-400 placeholder:text-text-tertiary/50"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a command..."
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>
      )}
    </div>
  );
}
