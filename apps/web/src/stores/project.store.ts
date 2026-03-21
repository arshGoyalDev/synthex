import { create } from "zustand";
import type { Project } from "../types/project";

/* ——— Mock data (replace with API calls once project-service is ready) ——— */
const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    userId: "u1",
    name: "portfolio-site",
    language: "typescript",
    description:
      "Personal portfolio built with Next.js and Three.js animations",
    template: "nextjs",
    isPinned: true,
    createdAt: "2026-03-10T08:00:00Z",
    updatedAt: "2026-03-16T12:30:00Z",
  },
  {
    id: "2",
    userId: "u1",
    name: "api-gateway",
    language: "go",
    description: "High-performance API gateway with rate limiting and auth",
    template: null,
    isPinned: false,
    createdAt: "2026-03-05T14:00:00Z",
    updatedAt: "2026-03-15T09:15:00Z",
  },
  {
    id: "3",
    userId: "u1",
    name: "ml-pipeline",
    language: "python",
    description: "Data processing pipeline for training ML models",
    template: null,
    isPinned: false,
    createdAt: "2026-02-28T10:00:00Z",
    updatedAt: "2026-03-14T16:45:00Z",
  },
  {
    id: "4",
    userId: "u1",
    name: "chat-app",
    language: "typescript",
    description: "Real-time chat application with WebSocket support",
    template: "vite-react",
    isPinned: true,
    createdAt: "2026-03-01T09:00:00Z",
    updatedAt: "2026-03-13T11:20:00Z",
  },
  {
    id: "5",
    userId: "u1",
    name: "cli-tool",
    language: "rust",
    description: "Command-line file organizer with pattern matching",
    template: null,
    isPinned: false,
    createdAt: "2026-02-20T15:00:00Z",
    updatedAt: "2026-03-12T08:00:00Z",
  },
  {
    id: "6",
    userId: "u1",
    name: "blog-engine",
    language: "javascript",
    description: null,
    template: "express",
    isPinned: false,
    createdAt: "2026-02-15T11:00:00Z",
    updatedAt: "2026-03-10T14:30:00Z",
  },
  {
    id: "7",
    userId: "u1",
    name: "discord-bot",
    language: "typescript",
    description: "Server moderation bot with music playback features",
    template: "node",
    isPinned: false,
    createdAt: "2026-02-05T10:00:00Z",
    updatedAt: "2026-03-09T18:20:00Z",
  },
  {
    id: "8",
    userId: "u1",
    name: "weather-widget",
    language: "python",
    description: "Desktop widget for local weather forecasts",
    template: "null",
    isPinned: false,
    createdAt: "2026-01-20T09:00:00Z",
    updatedAt: "2026-02-01T14:15:00Z",
  },
];

interface ProjectState {
  projects: Project[];
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  togglePin: (id: string) => void;
  updateProject: (
    id: string,
    data: Partial<Pick<Project, "name" | "description" | "language">>,
  ) => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    // TODO: Replace with API call: const { data } = await api.get("/api/projects/me");
    await new Promise((r) => setTimeout(r, 400)); // simulate network
    set({ projects: MOCK_PROJECTS, isLoading: false });
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
