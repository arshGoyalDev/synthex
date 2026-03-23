import { api } from "../lib/api";
import type { Project } from "../types/project";

export const getProjectsMe = async (): Promise<Project[]> => {
  const { data } = await api.get("/api/projects/me");
  return data.data;
};

export const getProjectById = async (id: string): Promise<Project> => {
  const { data } = await api.get(`/api/projects/${id}`);
  return data.data;
};

export interface CreateProjectPayload {
  name: string;
  description?: string;
  template?: string;
  languages?: string[];
  type: "template" | "blank" | "raw";
}

export const createProject = async (payload: CreateProjectPayload): Promise<Project> => {
  const { data } = await api.post("/api/projects", payload);
  return data.data;
};

export const startProject = async (id: string): Promise<{status: string, message: string}> => {
  const { data } = await api.post(`/api/projects/${id}/start`);
  return data;
};

export const stopProject = async (id: string): Promise<void> => {
  await api.post(`/api/projects/${id}/stop`);
};
