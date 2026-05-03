import { api } from "../lib/api";
import { encodeFilePath, stripLeadingSlash } from "../utils/filePath";

interface StorageFileRecord {
  projectId: string;
  filePath: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | string | null;
  content?: string | null;
}

const listFiles = async (projectId: string): Promise<StorageFileRecord[]> => {
  const { data } = await api.get(`/api/storage/files/${projectId}`);
  return data.data;
};

const getFile = async (
  projectId: string,
  filePath: string,
): Promise<StorageFileRecord> => {
  const encoded = encodeFilePath(filePath);
  const { data } = await api.get(
    `/api/storage/files/${projectId}/${encoded}`,
  );
  return data.data;
};

const saveFile = async (
  projectId: string,
  filePath: string,
  content: string,
): Promise<void> => {
  await api.post(`/api/storage/files/${projectId}`, {
    filePath: stripLeadingSlash(filePath),
    content,
  });
};

const deleteFile = async (projectId: string, filePath: string): Promise<void> => {
  const encoded = encodeFilePath(filePath);
  await api.delete(`/api/storage/files/${projectId}/${encoded}`);
};

const renameFile = async (
  projectId: string,
  filePath: string,
  newPath: string,
): Promise<void> => {
  const encoded = encodeFilePath(filePath);
  await api.put(`/api/storage/files/${projectId}/${encoded}`, {
    newPath: stripLeadingSlash(newPath),
  });
};

export type { StorageFileRecord };
export { listFiles, getFile, saveFile, deleteFile, renameFile };
