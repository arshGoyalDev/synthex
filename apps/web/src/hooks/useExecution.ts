import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import {
  startExecution as apiStartExecution,
  killExecution as apiKillExecution,
  type OutputChunk,
} from "../services/execution.service";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "timeout"
  | "killed"
  | "error";

export interface UseExecutionReturn {
  /** Raw base64-decoded output lines ready for xterm.write() */
  outputChunks: DecodedChunk[];
  /** Current execution status */
  status: ExecutionStatus;
  /** Process exit code (null while running) */
  exitCode: number | null;
  /** Duration in ms (null while running) */
  durationMs: number | null;
  /** Whether an execution is in-flight */
  isRunning: boolean;
  /** Current executionId (null when idle) */
  executionId: string | null;
  /** Error message if something went wrong */
  errorMessage: string | null;
  /** Start a new execution */
  run: (
    command: string,
    opts?: { workDir?: string; envVars?: Record<string, string> },
  ) => Promise<void>;
  /** Kill the current execution */
  kill: () => Promise<void>;
  /** Clear all output */
  clear: () => void;
  /** Send stdin input to the running execution */
  sendInput: (input: string) => void;
}

export interface DecodedChunk {
  seq: number;
  data: string; // decoded UTF-8 text
  type: "stdout" | "stderr";
  timestamp: number;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useExecution(
  projectId: string,
  projectName: string,
): UseExecutionReturn {
  const { socket } = useSocket();

  const [outputChunks, setOutputChunks] = useState<DecodedChunk[]>([]);
  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track the highest seq seen for reconnection replay
  const maxSeqRef = useRef(0);
  const seenSeqRef = useRef<Set<number>>(new Set());
  // Prevent double-clicks
  const runningRef = useRef(false);

  const isRunning = status === "queued" || status === "running";

  // ─── Decode a base64 output chunk ───────────────────────────────────────
  const decodeChunk = useCallback((chunk: OutputChunk): DecodedChunk => {
    let decoded: string;
    try {
      const binary = atob(chunk.data);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      decoded = new TextDecoder().decode(bytes);
    } catch {
      decoded = chunk.data;
    }
    return {
      seq: chunk.seq,
      data: decoded,
      type: chunk.type,
      timestamp: chunk.timestamp,
    };
  }, []);

  // ─── WebSocket listeners ────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !executionId) return;

    // Join the execution room
    socket.emit("execution:join", {
      executionId,
      fromSeq: maxSeqRef.current + 1,
    });

    const onOutput = (data: OutputChunk & { executionId: string }) => {
      if (data.executionId !== executionId) return;
      if (seenSeqRef.current.has(data.seq)) return;

      seenSeqRef.current.add(data.seq);

      if (data.seq > maxSeqRef.current) {
        maxSeqRef.current = data.seq;
      }

      const decoded = decodeChunk(data);
      setOutputChunks((prev) => [...prev, decoded]);
    };

    const onStatus = (data: { executionId: string; status: string }) => {
      if (data.executionId !== executionId) return;
      setStatus(data.status as ExecutionStatus);
    };

    const onError = (data: { executionId: string; message: string }) => {
      if (data.executionId !== executionId) return;
      setStatus("error");
      setErrorMessage(data.message);
      runningRef.current = false;
    };

    const onDone = (data: {
      executionId: string;
      exitCode: number;
      durationMs: number;
      timedOut: boolean;
    }) => {
      if (data.executionId !== executionId) return;

      const finalStatus: ExecutionStatus = data.timedOut
        ? "timeout"
        : data.exitCode === 0
          ? "completed"
          : "failed";

      setStatus(finalStatus);
      setExitCode(data.exitCode);
      setDurationMs(data.durationMs);
      runningRef.current = false;
    };

    socket.on("execution:output", onOutput);
    socket.on("execution:status", onStatus);
    socket.on("execution:error", onError);
    socket.on("execution:done", onDone);

    return () => {
      socket.off("execution:output", onOutput);
      socket.off("execution:status", onStatus);
      socket.off("execution:error", onError);
      socket.off("execution:done", onDone);
      socket.emit("execution:leave", { executionId });
    };
  }, [socket, executionId, decodeChunk]);

  // ─── Run ────────────────────────────────────────────────────────────────
  const run = useCallback(
    async (command: string, opts?: { workDir?: string; envVars?: Record<string, string> }) => {
      if (runningRef.current) return;

      // Reset state
      setOutputChunks([]);
      setExitCode(null);
      setDurationMs(null);
      setErrorMessage(null);
      setStatus("queued");
      maxSeqRef.current = 0;
      seenSeqRef.current = new Set();
      runningRef.current = true;

      try {
        const result = await apiStartExecution(
          projectId,
          projectName,
          command,
          opts,
        );
        setExecutionId(result.executionId);
        setStatus(result.status as ExecutionStatus);
      } catch (err: unknown) {
        runningRef.current = false;
        setStatus("error");

        if (err && typeof err === "object" && "response" in err) {
          const axErr = err as {
            response?: { status?: number; data?: { error?: string } };
          };
          if (axErr.response?.status === 409) {
            setErrorMessage(
              "Another execution is already running for this project",
            );
          } else {
            setErrorMessage(
              axErr.response?.data?.error ?? "Failed to start execution",
            );
          }
        } else {
          setErrorMessage("Failed to start execution");
        }
      }
    },
    [projectId, projectName],
  );

  // ─── Send stdin input ────────────────────────────────────────────────
  const sendInput = useCallback(
    (input: string) => {
      if (!socket || !executionId) return;
      socket.emit("execution:input", { executionId, input });
    },
    [socket, executionId],
  );

  // ─── Kill ───────────────────────────────────────────────────────────────
  const kill = useCallback(async () => {
    if (!executionId) return;

    try {
      await apiKillExecution(executionId);
      setStatus("killed");
      runningRef.current = false;
    } catch (err: unknown) {
      console.error("[useExecution] Kill failed:", err);
    }
  }, [executionId]);

  // ─── Clear ──────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    setOutputChunks([]);
    setExitCode(null);
    setDurationMs(null);
    setErrorMessage(null);
    setStatus("idle");
    setExecutionId(null);
    maxSeqRef.current = 0;
    seenSeqRef.current = new Set();
    runningRef.current = false;
  }, []);

  return {
    outputChunks,
    status,
    exitCode,
    durationMs,
    isRunning,
    executionId,
    errorMessage,
    run,
    kill,
    clear,
    sendInput,
  };
}
