import axios from "axios";
import { api } from "../lib/api";
import type { Project } from "../types/project";

const BASE = "/api/projects/import";
const UPLOAD_BASE = "/api/storage/upload";

// ─── Detection ────────────────────────────────────────────────────────────────

export interface DetectionResult {
  language: string | null;
  languages: string[];
  framework: string | null;
  runCommand: string | null;
  installCommand: string | null;
  previewCommand: string | null;
  port: number | null;
  isPreview: boolean;
}

export interface GithubDetection extends DetectionResult {
  name: string;
  description?: string;
  repoUrl: string;
  repoBranch: string;
}

export interface GithubRepoInfo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  description?: string | null;
}

export const listGithubRepos = async (): Promise<GithubRepoInfo[]> => {
  const { data } = await api.get(`${BASE}/github/repos`);
  return data.data;
};

export const detectGithubRepo = async (repoUrl: string): Promise<GithubDetection> => {
  const { data } = await api.post(`${BASE}/github/detect`, { repoUrl });
  return data.data;
};

export const detectZip = async (
  filePaths: string[],
  fileContents: Record<string, string>,
): Promise<DetectionResult> => {
  const { data } = await api.post(`${BASE}/zip/detect`, { filePaths, fileContents });
  return data.data;
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export interface ZipUploadResult {
  zipKey: string;
  filePaths: string[];
  fileContents: Record<string, string>;
  originalName: string;
}

export interface ZipUploadInitResult {
  zipKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresInSeconds: number;
  originalName: string;
}

export const initZipUpload = async (
  file: File,
): Promise<ZipUploadInitResult> => {
  const { data } = await api.post(`${UPLOAD_BASE}/zip/init`, {
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || "application/zip",
  });

  return data.data;
};

export const uploadZipToObjectStore = async (
  file: File,
  init: ZipUploadInitResult,
  onProgress?: (pct: number) => void,
): Promise<void> => {
  await axios.put(init.uploadUrl, file, {
    headers: init.uploadHeaders,
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
};

export const completeZipUpload = async (
  zipKey: string,
): Promise<ZipUploadResult> => {
  const { data } = await api.post(`${UPLOAD_BASE}/zip/complete`, { zipKey });
  return data.data;
};

// ─── Import ───────────────────────────────────────────────────────────────────

export interface ImportPayload {
  name: string;
  description?: string;
  runCommand?: string;
  previewCommand?: string;
  previewPort?: number;
  installCommand?: string;
  isPreview: boolean;
  languages: string[];
  envVars?: Record<string, string>;
}

export const importFromGithub = async (
  repoUrl: string,
  repoBranch: string,
  payload: ImportPayload,
): Promise<Project> => {
  const { data } = await api.post(`${BASE}/github`, {
    repoUrl,
    repoBranch,
    ...payload,
  });
  return data.data;
};

export const importFromZip = async (
  zipKey: string,
  payload: ImportPayload,
): Promise<Project> => {
  const { data } = await api.post(`${BASE}/zip`, { zipKey, ...payload });
  return data.data;
};
