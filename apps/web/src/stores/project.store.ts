import { create } from "zustand";
import type { Project } from "../types/project";
import { api } from "../lib/api";

interface ProjectState {
  projects: Project[];
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  togglePin: (id: string) => void;
  updateProject: (
    id: string,
    data: Partial<Pick<Project, "name" | "description" | "languages" | "template">>,
  ) => void;
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

  renameProject: (id, name) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p,
      ),
    })),

  deleteProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

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