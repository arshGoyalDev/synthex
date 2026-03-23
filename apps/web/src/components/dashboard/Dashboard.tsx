import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/auth.store";
import { useProjectStore } from "../../stores/project.store";
import { startProject } from "../../services/project.service";
import type { Project } from "../../types/project";
import { CreateProjectModal } from "../CreateProjectModal";
import { IconPlus, IconCode } from "../icons";
import { Sidebar } from "./Sidebar";
import { ActivityGraph } from "./ActivityGraph";
import { ProjectCard } from "./ProjectCard";
import { DeleteDialog, EditDetailsDialog, RenameDialog } from "./ProjectDialogs";

/* ——— Projects Grid ——— */
function ProjectsGrid() {
  const navigate = useNavigate();
  const { projects, isLoading, fetchProjects, togglePin } = useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const lowerQuery = searchQuery.toLowerCase();
    return projects.filter((p) => {
      const matchName = p.name?.toLowerCase().includes(lowerQuery);
      const matchDesc = p.description?.toLowerCase().includes(lowerQuery);
      const matchLang = p.languages?.some((l) => l.toLowerCase().includes(lowerQuery));
      const matchTemplate = p.template?.toLowerCase().includes(lowerQuery);
      return matchName || matchDesc || matchLang || matchTemplate;
    });
  }, [projects, searchQuery]);

  const sorted = [...filteredProjects].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleProjectClick = async (projectId: string) => {
    try {
      await startProject(projectId);
      navigate({ to: `/project/${projectId}` });
    } catch (err) {
      console.error("Failed to start project:", err);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
        
        <ActivityGraph />

        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight m-0">
              Projects
            </h1>
            <p className="text-sm text-text-tertiary mt-1 m-0">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Fake Search Input */}
            <div className="relative group hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary group-focus-within:text-accent-primary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
              </div>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..." 
                className="w-64 pl-9 pr-4 py-2 rounded-lg bg-bg-secondary border border-border-default text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all shadow-sm"
              />
            </div>

            <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-text-primary text-bg-primary font-medium text-sm hover:bg-white transition-colors cursor-pointer border-none shadow-sm"
            >
              <IconPlus size={16} />
              New Project
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <span className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4 text-text-tertiary">
              <IconCode size={28} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              No projects yet
            </h2>
            <p className="text-sm text-text-tertiary mb-6 max-w-sm">
              Create your first project to start coding in the cloud.
            </p>
            <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-text-primary text-bg-primary font-medium text-sm hover:bg-white transition-colors cursor-pointer border-none shadow-sm"
            >
              <IconPlus size={16} />
              Create Project
            </button>
          </div>
        )}

        {!isLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
            {sorted.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={() => setDeleteTarget(p)}
                onTogglePin={() => togglePin(p.id)}
                onEdit={() => setEditTarget(p)}
                onClick={() => handleProjectClick(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteDialog
        project={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <EditDetailsDialog
        projectId={editTarget?.id ?? null}
        isOpen={!!editTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setEditTarget(null) }}
      />
      <RenameDialog
        project={editTarget}
        open={false}
        onClose={() => {}}
      />

      <CreateProjectModal 
        isOpen={isNewProjectModalOpen} 
        onOpenChange={setIsNewProjectModalOpen} 
      />
    </main>
  );
}

/* ——— Dashboard ——— */
export function Dashboard() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <ProjectsGrid />
    </div>
  );
}
