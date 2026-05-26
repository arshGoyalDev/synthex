import { create } from "zustand";
import type { Project } from "../types/project";
import { api } from "../lib/api";
import {
  deleteProject as apiDeleteProject,
  renameProject as apiRenameProject,
} from "../services/project.service";

interface ProjectState {
  projects: Project[];
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  togglePin: (id: string) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get("/api/projects/me");
      set({ projects: data.data, isLoading: false });
    } catch (err) {
      console.error(err);
      set({ isLoading: false });
    }
  },

  renameProject: async (id, name) => {
    const previousProjects = useProjectStore.getState().projects;
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p,
      ),
    }));

    try {
      const updated = await apiRenameProject(id, name);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? updated : p)),
      }));
    } catch (err) {
      set({ projects: previousProjects });
      throw err;
    }
  },

  deleteProject: async (id) => {
    const previousProjects = useProjectStore.getState().projects;
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));

    try {
      await apiDeleteProject(id);
    } catch (err) {
      set({ projects: previousProjects });
      throw err;
    }
  },

  togglePin: (id) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, isPinned: !p.isPinned } : p,
      ),
    })),

  updateProject: (id, data) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id
          ? { ...p, ...data, updatedAt: new Date().toISOString() }
          : p,
      ),
    })),
}));
