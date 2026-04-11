import { useState, useMemo, useEffect } from "react";
import { useEditorStore } from "../../stores/editor.store";
import {
  FileCode,
  FileType,
  FileJson,
  FileText,
  File,
  ChevronRight,
  ChevronDown,
  Search,
  Replace,
  CornerDownRight,
  X,
  RotateCcw,
} from "lucide-react";

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
      return <FileCode size={14} className="text-blue-500 shrink-0" />;
    case "css":
      return <FileType size={14} className="text-purple-500 shrink-0" />;
    case "json":
      return <FileJson size={14} className="text-yellow-500 shrink-0" />;
    case "md":
      return <FileText size={14} className="text-gray-500 shrink-0" />;
    default:
      return <File size={14} className="text-zinc-500 shrink-0" />;
  }
}

interface MatchResult {
  lineNum: number;
  highlightedLine: { before: string; match: string; after: string };
  rawLine: string;
}

export function GlobalSearch() {
  const globalSearchQuery = useEditorStore((s) => s.globalSearchQuery);
  const setGlobalSearchQuery = useEditorStore((s) => s.setGlobalSearchQuery);

  const [localSearchQuery, setLocalSearchQuery] = useState(globalSearchQuery);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [excludedFiles, setExcludedFiles] = useState<Set<string>>(new Set());

  const filesMap = useEditorStore((s) => s.files);
  const replaceAll = useEditorStore((s) => s.replaceAll);
  const replaceNext = useEditorStore((s) => s.replaceNext);
  const openFile = useEditorStore((s) => s.openFile);
  const setActiveSearchMatch = useEditorStore((s) => s.setActiveSearchMatch);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalSearchQuery(localSearchQuery);
      setExcludedFiles(new Set()); // Reset excluded files on every search update
    }, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [localSearchQuery, setGlobalSearchQuery]);

  const matchedFiles = useMemo(() => {
    if (!globalSearchQuery) return [];
    const results: { path: string; name: string; matches: MatchResult[] }[] =
      [];

    Array.from(filesMap.values()).forEach((file) => {
      if (file.isFolder || !file.content) return;
      const lines = file.content.split("\n");
      const fileMatches: MatchResult[] = [];

      lines.forEach((line, idx) => {
        const matchIndex = line.indexOf(globalSearchQuery);
        if (matchIndex !== -1) {
          fileMatches.push({
            lineNum: idx + 1,
            rawLine: line,
            highlightedLine: {
              before: line.substring(0, matchIndex).trimStart(),
              match: globalSearchQuery,
              after: line.substring(matchIndex + globalSearchQuery.length),
            },
          });
        }
      });

      if (fileMatches.length > 0) {
        results.push({
          path: file.path,
          name: file.name,
          matches: fileMatches,
        });
      }
    });

    return results;
  }, [filesMap, globalSearchQuery]);

  const toggleExpand = (path: string) => {
    const nextSet = new Set(expandedFiles);
    if (nextSet.has(path)) nextSet.delete(path);
    else nextSet.add(path);
    setExpandedFiles(nextSet);
  };

  const toggleExclude = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const nextSet = new Set(excludedFiles);
    if (nextSet.has(path)) nextSet.delete(path);
    else nextSet.add(path);
    setExcludedFiles(nextSet);
  };

  const handleReplaceNext = () => {
    replaceNext(globalSearchQuery, replaceQuery, excludedFiles);
  };

  const handleReplaceAll = () => {
    replaceAll(globalSearchQuery, replaceQuery, excludedFiles);
  };

  const totalMatches = matchedFiles.reduce(
    (acc, f) => (excludedFiles.has(f.path) ? acc : acc + f.matches.length),
    0,
  );

  return (
    <div className="flex flex-col h-full bg-bg-secondary text-text-primary overflow-hidden">
      <div className="flex px-4 py-3 h-8 items-center text-[11px] font-semibold tracking-wider text-text-secondary uppercase shrink-0 border-b border-border-subtle">
        Search & Replace
      </div>

      <div className="flex flex-col p-3 gap-2 shrink-0 border-b border-border-subtle">
        <div className="flex items-center gap-2 bg-bg-dark-secondary border border-border-subtle rounded-md px-2 focus-within:border-accent-primary transition-colors">
          <Search size={14} className="text-text-tertiary" />
          <input
            className="flex-1 bg-transparent border-none outline-none py-1.5 text-[13px] text-text-primary placeholder:text-text-tertiary font-sans min-w-0"
            placeholder="Search"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-bg-dark-secondary border border-border-subtle rounded-md px-2 focus-within:border-accent-primary transition-colors">
          <Replace size={14} className="text-text-tertiary" />
          <input
            className="flex-1 bg-transparent border-none outline-none py-1.5 text-[13px] text-text-primary placeholder:text-text-tertiary font-sans min-w-0"
            placeholder="Replace (Press Enter)"
            value={replaceQuery}
            disabled={!globalSearchQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && globalSearchQuery) {
                e.preventDefault();
                handleReplaceNext();
              }
            }}
          />
        </div>

        {globalSearchQuery && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-[12px] text-text-tertiary font-medium">
              {totalMatches} match{totalMatches !== 1 ? "es" : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                className="px-2 py-1 text-[11px] bg-bg-dark-secondary hover:bg-white/10 text-text-secondary hover:text-text-primary rounded border border-border-subtle cursor-pointer transition-colors"
                onClick={handleReplaceAll}
              >
                Replace All
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {globalSearchQuery === "" ? (
          <div className="px-4 py-8 text-center text-[13px] text-text-tertiary flex flex-col items-center gap-2">
            <Search size={24} className="opacity-50" />
            Search files for text
          </div>
        ) : matchedFiles.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-text-tertiary">
            No results found.
          </div>
        ) : (
          <div className="flex flex-col">
            {matchedFiles.map((file) => {
              const isExpanded = !expandedFiles.has(file.path);
              const isExcluded = excludedFiles.has(file.path);

              return (
                <div
                  key={file.path}
                  className={`flex flex-col ${isExcluded ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center group/file w-full">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1 bg-transparent border-none cursor-pointer flex-1 text-left min-w-0"
                      onClick={() => toggleExpand(file.path)}
                    >
                      <span className="text-text-tertiary shrink-0 mt-0.5">
                        {isExpanded ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </span>
                      {getFileIcon(file.name)}
                      <span
                        className={`text-[13px] font-medium text-text-primary truncate ${isExcluded ? "line-through opacity-80" : ""}`}
                      >
                        {file.name}
                      </span>
                      <span className="text-[11px] text-text-tertiary bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                        {file.matches.length}
                      </span>
                      <button
                        className="px-1 ml-auto cursor-pointer border-none bg-transparent text-text-tertiary hover:text-text-primary transition-opacity"
                        title={
                          isExcluded ? "Include file" : "Exclude from replace"
                        }
                        onClick={(e) => toggleExclude(e, file.path)}
                      >
                        {isExcluded ? <RotateCcw size={14} /> : <X size={14} />}
                      </button>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col py-0.5">
                      {file.matches.map((match, i) => (
                        <button
                          key={i}
                          className="flex items-start gap-2 pl-8 pr-3 py-0.5 cursor-pointer bg-transparent border-none text-left w-full hover:bg-white/5 transition-colors group"
                          onClick={() => {
                            const f = filesMap.get(file.path);
                            if (f) {
                              openFile(f);
                              // Timeout ensures the file actually opens before forcing camera/monaco to highlight target
                              setTimeout(
                                () =>
                                  setActiveSearchMatch(
                                    file.path,
                                    match.lineNum,
                                  ),
                                50,
                              );
                            }
                          }}
                        >
                          <CornerDownRight
                            size={12}
                            className="text-text-tertiary shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0 text-[12px] font-mono leading-relaxed truncate">
                            <span className="text-text-tertiary mr-2 opacity-50">
                              {match.lineNum}
                            </span>
                            <span className="text-text-secondary">
                              {match.highlightedLine.before}
                            </span>
                            <span className="text-accent-primary bg-accent-primary/10 rounded-sm">
                              {match.highlightedLine.match}
                            </span>
                            <span className="text-text-secondary">
                              {match.highlightedLine.after}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
