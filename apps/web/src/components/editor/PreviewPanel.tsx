import {
  Loader2,
  RefreshCw,
  ExternalLink,
  Square,
  AlertCircle,
  Globe,
  ChevronDown,
  ChevronUp,
  Play,
} from "lucide-react";
import { useState } from "react";
import type { UsePreviewReturn } from "../../hooks/usePreview";

interface PreviewPanelProps {
  preview: UsePreviewReturn;
  projectId: string;
  previewCommand: string | null;
  previewPort: number | null;
  templateId: string | null;
}

export function PreviewPanel({
  preview,
  projectId,
  previewCommand,
  previewPort,
  templateId,
}: PreviewPanelProps) {
  const {
    previewFrameUrl,
    previewStatus,
    previewOutput,
    errorMessage,
    start,
    stop,
    refresh,
    refreshKey,
  } = preview;

  const [showConsole, setShowConsole] = useState(false);

  const fullUrl = previewFrameUrl;

  const canStart = !!previewCommand && !!previewPort;

  const handleStart = () => {
    if (!previewCommand || !previewPort) return;
    start(previewCommand, previewPort, templateId ?? undefined);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-dark-secondary">
      {/* Toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border-subtle bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary flex items-center gap-1.5">
            <Globe size={13} />
            Preview
          </span>

          {previewStatus === "starting" && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Loader2 size={12} className="animate-spin" />
              Starting...
            </span>
          )}
          {previewStatus === "ready" && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              Live
            </span>
          )}
          {previewStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertCircle size={12} />
              {errorMessage ?? "Error"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Start button in toolbar for idle/stopped/error states */}
          {(previewStatus === "idle" ||
            previewStatus === "stopped" ||
            previewStatus === "error") &&
            canStart && (
              <button
                className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-accent-primary transition-colors hover:bg-accent-primary/10"
                onClick={handleStart}
                title={`Start: ${previewCommand}`}
              >
                <Play size={12} />
                <span>Start</span>
              </button>
            )}

          {previewStatus === "ready" && (
            <>
              <button
                className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                onClick={refresh}
                title="Refresh preview"
              >
                <RefreshCw size={12} />
              </button>

              <a
                href={fullUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                title="Open in new tab"
              >
                <ExternalLink size={12} />
              </a>

              <button
                className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                onClick={() => setShowConsole((v) => !v)}
                title="Toggle server console"
              >
                {showConsole ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronUp size={12} />
                )}
                <span>Console</span>
              </button>

              <button
                className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                onClick={stop}
                title="Stop preview server"
              >
                <Square size={12} />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* Preview iframe */}
        <div className="flex-1 min-h-0 overflow-hidden bg-white relative">
          {previewStatus === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary text-text-tertiary gap-3">
              <Globe size={32} className="opacity-30" />
              {canStart ? (
                <>
                  <span className="text-sm text-text-secondary">
                    Start the dev server to see a live preview
                  </span>
                  <button
                    className="flex items-center gap-2 mt-1 py-2 px-4 text-sm font-medium border-none rounded-lg cursor-pointer transition-all duration-150 text-white bg-indigo-600 hover:bg-indigo-500"
                    onClick={handleStart}
                  >
                    <Play size={14} />
                    Start Preview
                  </button>
                  <span className="text-xs text-text-tertiary mt-1 font-mono">
                    {previewCommand}
                  </span>
                </>
              ) : (
                <span className="text-sm">
                  No preview available for this project type
                </span>
              )}
            </div>
          )}

          {previewStatus === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary gap-3">
              <Loader2
                size={24}
                className="animate-spin text-accent-primary"
              />
              <span className="text-sm text-text-secondary">
                Starting dev server...
              </span>
              <span className="text-xs text-text-tertiary">
                This may take a moment
              </span>
            </div>
          )}

          {previewStatus === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary gap-3">
              <AlertCircle size={24} className="text-red-400" />
              <span className="text-sm text-red-400">
                {errorMessage ?? "Preview failed to start"}
              </span>
              {canStart && (
                <button
                  className="flex items-center gap-2 mt-2 py-1.5 px-3 text-xs font-medium border border-border-subtle rounded-md cursor-pointer transition-all duration-150 text-text-secondary bg-bg-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  onClick={handleStart}
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              )}
            </div>
          )}

          {previewStatus === "stopped" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary text-text-tertiary gap-3">
              <Globe size={32} className="opacity-30" />
              <span className="text-sm">Preview stopped</span>
              {canStart && (
                <button
                  className="flex items-center gap-2 mt-1 py-1.5 px-3 text-xs font-medium border border-border-subtle rounded-md cursor-pointer transition-all duration-150 text-text-secondary bg-bg-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  onClick={handleStart}
                >
                  <Play size={12} />
                  Restart
                </button>
              )}
            </div>
          )}

          {previewStatus === "ready" && fullUrl && (
            <>
              {/* URL bar */}
              <div className="absolute top-0 left-0 right-0 h-7 bg-bg-secondary border-b border-border-subtle flex items-center px-2 z-10">
                <div className="flex-1 flex items-center gap-2 rounded bg-bg-primary/50 px-2 py-0.5 text-[11px] text-text-tertiary font-mono truncate">
                  <Globe size={10} className="shrink-0" />
                  {fullUrl}
                </div>
              </div>
              <iframe
                key={refreshKey}
                src={fullUrl}
                className="w-full h-full border-none pt-7"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                title={`Preview for ${projectId}`}
              />
            </>
          )}
        </div>

        {/* Server console (collapsible) */}
        {showConsole && previewOutput.length > 0 && (
          <div className="shrink-0 h-64 border-t border-border-subtle bg-bg-primary overflow-y-auto">
            <div className="p-2 font-mono text-xs text-text-secondary">
              {previewOutput.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
