import { api } from "../lib/api";
import type { Project } from "../types/project";

const startProjectRequests = new Map<
  string,
  Promise<{
    status: string;
    message: string;
    runCommand?: string | null;
    previewCommand?: string | null;
    previewPort?: number | null;
  }>
>();

export const getProjectsMe = async (): Promise<Project[]> => {
  const { data } = await api.get("/api/projects/me");
  return data.data;
};

export const getProjectById = async (id: string): Promise<Project> => {
  const { data } = await api.get(`/api/projects/${id}`);
  return data.data;
};

export const getProjectEnvVars = async (
  id: string,
): Promise<{ envVars: Record<string, string> | null }> => {
  const { data } = await api.get(`/api/projects/${id}/env`);
  return data.data;
};

export interface UpdateProjectPayload {
  name: string;
  description?: string | null;
  autoSaveEnabled?: boolean;
}

export interface UpdateProjectConfigPayload {
  runCommand?: string | null;
  previewCommand?: string | null;
  previewPort?: number | null;
  installCommand?: string | null;
  envVars?: Record<string, string> | null;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  template?: string;
  languages?: string[];
  type: "template" | "blank" | "raw";
}

export const createProject = async (
  payload: CreateProjectPayload,
): Promise<Project> => {
  const { data } = await api.post("/api/projects", payload);
  return data.data;
};

export const startProject = async (
  id: string,
): Promise<{
  status: string;
  message: string;
  runCommand?: string | null;
  previewCommand?: string | null;
  previewPort?: number | null;
}> => {
  const inFlightRequest = startProjectRequests.get(id);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = api
    .post(`/api/projects/${id}/start`)
    .then(({ data }) => data)
    .finally(() => {
      startProjectRequests.delete(id);
    });

  startProjectRequests.set(id, request);

  return request;
};

export const stopProject = async (id: string): Promise<void> => {
  await api.post(`/api/projects/${id}/stop`);
};

export const renameProject = async (
  id: string,
  name: string,
): Promise<Project> => {
  const { data } = await api.patch(`/api/projects/${id}`, { name });
  return data.data;
};

export const updateProject = async (
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> => {
  const { data } = await api.patch(`/api/projects/${id}`, payload);
  return data.data;
};

export const updateProjectConfig = async (
  id: string,
  payload: UpdateProjectConfigPayload,
): Promise<Project> => {
  const { data } = await api.put(`/api/projects/${id}/config`, payload);
  return data.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await api.delete(`/api/projects/${id}`);
};
