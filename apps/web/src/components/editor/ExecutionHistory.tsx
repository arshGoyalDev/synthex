import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Square,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useEditorStore } from "../../stores/editor.store";
import {
  getExecutionHistory,
  type ExecutionRecord,
} from "../../services/execution.service";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function statusBadge(status: string) {
  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-green-400">
        <CheckCircle2 size={12} />
        Completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-red-400">
        <XCircle size={12} />
        Failed
      </span>
    );
  }
  if (status === "timeout") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-orange-400">
        <Clock size={12} />
        Timed out
      </span>
    );
  }
  if (status === "killed") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
        <Square size={12} />
        Killed
      </span>
    );
  }
  if (status === "running" || status === "queued") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-yellow-400">
        <Loader2 size={12} className="animate-spin" />
        {status === "queued" ? "Queued" : "Running"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-red-400">
        <AlertCircle size={12} />
        Error
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-text-tertiary">
      <Clock size={12} />
      {status}
    </span>
  );
}

function getSummary(record: ExecutionRecord) {
  const output = record.output ?? "";
  const error = record.error ?? "";
  const combined = [output, error].filter(Boolean).join("\n").trim();
  const firstLine = combined.split("\n")[0] ?? "";
  return firstLine.slice(0, 160);
}

export function ExecutionHistory() {
  const projectId = useEditorStore((s) => s.projectId);
  const selectedExecutionLog = useEditorStore((s) => s.selectedExecutionLog);
  const setSelectedExecutionLog = useEditorStore((s) => s.setSelectedExecutionLog);
  const toggleRightPanel = useEditorStore((s) => s.toggleRightPanel);
  const isRightPanelOpen = useEditorStore((s) => s.isRightPanelOpen);
  const executionHistoryTick = useEditorStore((s) => s.executionHistoryTick);

  const [history, setHistory] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [history],
  );

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    setLoading(true);
    setError(null);
    getExecutionHistory(projectId)
      .then((items) => {
        if (!isMounted) return;
        setHistory(items ?? []);
      })
      .catch((err) => {
        if (!isMounted) return;
        const message = err?.message ?? "Failed to load execution history";
        setError(message);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, executionHistoryTick]);

  const handleSelect = (record: ExecutionRecord) => {
    setSelectedExecutionLog(record);
    if (!isRightPanelOpen) {
      toggleRightPanel();
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary text-text-primary overflow-hidden">
      <div className="flex px-4 py-3 h-8 items-center text-[11px] font-semibold tracking-wider text-text-secondary uppercase shrink-0 border-b border-border-subtle">
        Execution History
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 gap-2 text-text-tertiary">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-xs">Loading history…</span>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center py-8 px-3">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {!loading && !error && sortedHistory.length === 0 && (
        <div className="px-4 py-8 text-center text-[13px] text-text-tertiary flex flex-col items-center gap-2">
          <Clock size={24} className="opacity-50" />
          No executions yet
        </div>
      )}

      {!loading && !error && sortedHistory.length > 0 && (
        <div className="flex-1 overflow-y-auto py-2">
          {sortedHistory.map((record) => {
            const isActive = selectedExecutionLog?.executionId === record.executionId;
            return (
              <button
                key={record.executionId}
                className={`group w-full px-4 py-2 text-left border-none bg-transparent transition-colors hover:bg-white/[0.04] ${
                  isActive ? "bg-accent-primary/10" : ""
                }`}
                onClick={() => handleSelect(record)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-text-primary truncate">
                    {record.command}
                  </span>
                  <span className="text-[11px] text-text-tertiary shrink-0">
                    {timeAgo(record.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[11px] text-text-tertiary truncate">
                    {getSummary(record) || "No output"}
                  </span>
                  <span className="shrink-0">{statusBadge(record.status)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
