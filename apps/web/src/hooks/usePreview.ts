import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import {
  startPreview as apiStartPreview,
  stopPreview as apiStopPreview,
} from "../services/execution.service";

export type PreviewStatus =
  | "idle"
  | "starting"
  | "ready"
  | "error"
  | "stopped";

export interface UsePreviewReturn {
  previewUrl: string | null;
  /** Full iframe URL including one-time access token when required */
  previewFrameUrl: string | null;
  previewStatus: PreviewStatus;
  previewOutput: string[];
  errorMessage: string | null;
  start: (
    command: string,
    port: number,
    templateId?: string,
    envVars?: Record<string, string>,
  ) => Promise<void>;
  stop: () => Promise<void>;
  refresh: () => void;
  refreshKey: number;
}

function buildPreviewFrameUrl(
  previewPath: string | null,
  previewAccessToken: string | null,
): string | null {
  if (!previewPath) return null;

  const base = `${import.meta.env.VITE_SERVER_URL}${previewPath}`;
  if (!previewAccessToken) return base;

  const separator = previewPath.includes("?") ? "&" : "?";
  return `${base}${separator}previewToken=${encodeURIComponent(previewAccessToken)}`;
}

export function usePreview(
  projectId: string,
  projectName: string,
): UsePreviewReturn {
  const { socket } = useSocket();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAccessToken, setPreviewAccessToken] = useState<string | null>(
    null,
  );
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewOutput, setPreviewOutput] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const startingRef = useRef(false);

  const previewFrameUrl = useMemo(
    () => buildPreviewFrameUrl(previewUrl, previewAccessToken),
    [previewUrl, previewAccessToken],
  );

  useEffect(() => {
    if (!socket) return;

    const onPreviewStatus = (data: {
      projectId: string;
      status: string;
      previewUrl?: string;
      previewAccessToken?: string;
      message?: string;
    }) => {
      if (data.projectId !== projectId) return;

      if (data.status === "ready" && data.previewUrl) {
        setPreviewUrl(data.previewUrl);
        setPreviewAccessToken(data.previewAccessToken ?? null);
        setPreviewStatus("ready");
        setErrorMessage(null);
        startingRef.current = false;
      } else if (data.status === "error") {
        setPreviewStatus("error");
        setErrorMessage(data.message ?? "Preview failed to start");
        startingRef.current = false;
      } else if (data.status === "stopped") {
        setPreviewUrl(null);
        setPreviewAccessToken(null);
        setPreviewStatus("stopped");
        startingRef.current = false;
      }
    };

    const onPreviewOutput = (data: { projectId: string; data: string }) => {
      if (data.projectId !== projectId) return;
      setPreviewOutput((prev) => {
        const next = [...prev, data.data];
        return next.length > 500 ? next.slice(-500) : next;
      });
    };

    socket.on("preview:status", onPreviewStatus);
    socket.on("preview:output", onPreviewOutput);

    socket.emit("preview:join", { projectId });

    return () => {
      socket.off("preview:status", onPreviewStatus);
      socket.off("preview:output", onPreviewOutput);
      socket.emit("preview:leave", { projectId });
    };
  }, [socket, projectId]);

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
          setPreviewAccessToken(result.previewAccessToken ?? null);
          setPreviewStatus("ready");
          startingRef.current = false;
        }
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

  const stop = useCallback(async () => {
    try {
      await apiStopPreview(projectId);
      setPreviewUrl(null);
      setPreviewAccessToken(null);
      setPreviewStatus("stopped");
      setPreviewOutput([]);
      startingRef.current = false;
    } catch (err: unknown) {
      console.error("[usePreview] Stop failed:", err);
    }
  }, [projectId]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    previewUrl,
    previewFrameUrl,
    previewStatus,
    previewOutput,
    errorMessage,
    start,
    stop,
    refresh,
    refreshKey,
  };
}
