import { api } from "../lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StorageFileEntry {
  id: string;
  projectId: string;
  filePath: string;
  fileName: string;
  minioPath: string;
  sizeBytes: number | null;
  mimeType: string | null;
  contentHash?: string | null;
  content?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Path helpers ───────────────────────────────────────────────────────────

/**
 * Normalise a frontend path (leading `/`) to the storage-service format
 * (no leading `/`).  e.g. `/src/index.ts` → `src/index.ts`
 */
function toStoragePath(frontendPath: string): string {
  return frontendPath.replace(/^\/+/, "");
}

// ─── API calls ──────────────────────────────────────────────────────────────

const STORAGE_BASE = "/api/storage/files";

/**
 * Fetch the file list for a project (metadata only, no content).
 */
export async function listFiles(
  projectId: string,
): Promise<StorageFileEntry[]> {
  const { data } = await api.get(`${STORAGE_BASE}/${projectId}`);
  return data.data;
}

/**
 * Fetch a single file's content from storage.
 */
export async function getFileContent(
  projectId: string,
  filePath: string,
): Promise<StorageFileEntry> {
  const storagePath = toStoragePath(filePath);
  const { data } = await api.get(`${STORAGE_BASE}/${projectId}/${storagePath}`);
  return data.data;
}

/**
 * Save (create or update) a file's content.
 */
export async function saveFile(
  projectId: string,
  filePath: string,
  content: string,
): Promise<{
  filePath: string;
  sizeBytes: number;
  contentHash: string;
  updatedAt: string;
}> {
  const storagePath = toStoragePath(filePath);
  const { data } = await api.post(`${STORAGE_BASE}/${projectId}`, {
    filePath: storagePath,
    content,
  });
  return data.data;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(
  projectId: string,
  filePath: string,
): Promise<void> {
  const storagePath = toStoragePath(filePath);
  await api.delete(`${STORAGE_BASE}/${projectId}/${storagePath}`);
}

/**
 * Rename a file in storage.
 */
export async function renameFile(
  projectId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const storageOldPath = toStoragePath(oldPath);
  const storageNewPath = toStoragePath(newPath);
  await api.put(`${STORAGE_BASE}/${projectId}/${storageOldPath}`, {
    newPath: storageNewPath,
  });
}
