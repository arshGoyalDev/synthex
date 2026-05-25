import { api } from "../lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  executionId: string;
  status: string;
}

export interface PreviewResult {
  status: string;
  previewUrl?: string;
  projectId?: string;
}

export interface ExecutionRecord {
  executionId: string;
  projectId: string;
  userId: string;
  command: string;
  status: string;
  output: string | null;
  error: string | null;
  exitCode: number | null;
  durationMs: number | null;
  isDevServer: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface OutputChunk {
  seq: number;
  data: string; // base64 encoded
  type: "stdout" | "stderr";
  timestamp: number;
}

// ─── API calls ──────────────────────────────────────────────────────────────

const EXEC_BASE = "/api/execution";

/**
 * Start a one-shot command execution in the project container.
 * Returns immediately with an executionId — output streams via WebSocket.
 */
export async function startExecution(
  projectId: string,
  projectName: string,
  command: string,
  opts?: { workDir?: string; envVars?: Record<string, string> },
): Promise<ExecutionResult> {
  const { data } = await api.post(EXEC_BASE, {
    projectId,
    projectName,
    command,
    workDir: opts?.workDir,
    isDevServer: false,
    envVars: opts?.envVars,
  });
  return data.data;
}

/**
 * Start a dev-server preview in the project container.
 * The gateway sets up a reverse proxy at /preview/{projectId}/.
 */
export async function startPreview(
  projectId: string,
  projectName: string,
  command: string,
  port: number,
  templateId?: string,
  envVars?: Record<string, string>,
): Promise<PreviewResult> {
  const { data } = await api.post(`${EXEC_BASE}/preview`, {
    projectId,
    projectName,
    command,
    port,
    templateId,
    envVars,
  });
  return data.data;
}

/**
 * Stop a running preview for a project.
 */
export async function stopPreview(projectId: string): Promise<void> {
  await api.delete(`${EXEC_BASE}/preview/${projectId}`);
}

/**
 * Kill a running execution.
 */
export async function killExecution(executionId: string): Promise<void> {
  await api.delete(`${EXEC_BASE}/${executionId}`);
}

/**
 * Get execution details by ID.
 */
export async function getExecution(
  executionId: string,
): Promise<ExecutionRecord> {
  const { data } = await api.get(`${EXEC_BASE}/${executionId}`);
  return data.data;
}

/**
 * Get execution history for a project.
 */
export async function getExecutionHistory(
  projectId: string,
): Promise<ExecutionRecord[]> {
  const { data } = await api.get(`${EXEC_BASE}/project/${projectId}`);
  return data.data;
}

/**
 * Get buffered output chunks for an execution (for reconnect/replay).
 */
export async function getBufferedOutput(
  executionId: string,
  fromSeq = 0,
): Promise<OutputChunk[]> {
  const { data } = await api.get(`${EXEC_BASE}/${executionId}/buffer`, {
    params: { fromSeq },
  });
  return data.data;
}
