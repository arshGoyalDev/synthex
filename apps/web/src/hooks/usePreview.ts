import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import {
  startPreview as apiStartPreview,
  stopPreview as apiStopPreview,
} from "../services/execution.service";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PreviewStatus =
  | "idle"
  | "starting"
  | "ready"
  | "error"
  | "stopped";

export interface UsePreviewReturn {
  /** The URL to embed in an iframe (e.g. /preview/{projectId}/) */
  previewUrl: string | null;
  /** Current preview status */
  previewStatus: PreviewStatus;
  /** Server console output lines */
  previewOutput: string[];
  /** Error message if preview failed */
  errorMessage: string | null;
  /** Start the dev server preview */
  start: (
    command: string,
    port: number,
    templateId?: string,
    envVars?: Record<string, string>,
  ) => Promise<void>;
  /** Stop the dev server preview */
  stop: () => Promise<void>;
  /** Refresh the iframe */
  refresh: () => void;
  /** Refresh key — changes to force iframe reload */
  refreshKey: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePreview(
  projectId: string,
  projectName: string,
): UsePreviewReturn {
  const { socket } = useSocket();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewOutput, setPreviewOutput] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const startingRef = useRef(false);

  // ─── WebSocket listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onPreviewStatus = (data: {
      projectId: string;
      status: string;
      previewUrl?: string;
      message?: string;
    }) => {
      if (data.projectId !== projectId) return;

      if (data.status === "ready" && data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setPreviewStatus("ready");
        setErrorMessage(null);
        startingRef.current = false;
      } else if (data.status === "error") {
        setPreviewStatus("error");
        setErrorMessage(data.message ?? "Preview failed to start");
        startingRef.current = false;
      } else if (data.status === "stopped") {
        setPreviewUrl(null);
        setPreviewStatus("stopped");
        startingRef.current = false;
      }
    };

    const onPreviewOutput = (data: { projectId: string; data: string }) => {
      if (data.projectId !== projectId) return;
      setPreviewOutput((prev) => {
        const next = [...prev, data.data];
        // Keep last 500 lines
        return next.length > 500 ? next.slice(-500) : next;
      });
    };

    socket.on("preview:status", onPreviewStatus);
    socket.on("preview:output", onPreviewOutput);

    // Join preview room for output
    socket.emit("preview:join", { projectId });

    return () => {
      socket.off("preview:status", onPreviewStatus);
      socket.off("preview:output", onPreviewOutput);
      socket.emit("preview:leave", { projectId });
    };
  }, [socket, projectId]);

  // ─── Start ──────────────────────────────────────────────────────────────
  const start = useCallback(
    async (
      command: string,
      port: number,
      templateId?: string,
      envVars?: Record<string, string>,
    ) => {
      if (startingRef.current || previewStatus === "ready") return;

      startingRef.current = true;
      setPreviewStatus("starting");
      setErrorMessage(null);
      setPreviewOutput([]);

      try {
        const result = await apiStartPreview(
          projectId,
          projectName,
          command,
          port,
          templateId,
          envVars,
        );

        if (result.status === "already_running" && result.previewUrl) {
          setPreviewUrl(result.previewUrl);
          setPreviewStatus("ready");
          startingRef.current = false;
        }
        // Otherwise wait for WS preview:status event
      } catch (err: unknown) {
        startingRef.current = false;
        setPreviewStatus("error");

        if (err && typeof err === "object" && "response" in err) {
          const axErr = err as {
            response?: { data?: { error?: string } };
          };
          setErrorMessage(
            axErr.response?.data?.error ?? "Failed to start preview",
          );
        } else {
          setErrorMessage("Failed to start preview");
        }
      }
    },
    [projectId, projectName, previewStatus],
  );

  // ─── Stop ───────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    try {
      await apiStopPreview(projectId);
      setPreviewUrl(null);
      setPreviewStatus("stopped");
      setPreviewOutput([]);
      startingRef.current = false;
    } catch (err: unknown) {
      console.error("[usePreview] Stop failed:", err);
    }
  }, [projectId]);

  // ─── Refresh ────────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    previewUrl,
    previewStatus,
    previewOutput,
    errorMessage,
    start,
    stop,
    refresh,
    refreshKey,
  };
}
