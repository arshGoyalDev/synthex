import React, { useState, useEffect } from "react";
import type { Project } from "../../types/project";
import { useProjectStore } from "../../stores/project.store";

/* ——— Modal base ——— */
export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      style={{ animationDuration: "0.15s" }}
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border-default rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/40 animate-slide-up"
        style={{ animationDuration: "0.2s" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ——— Rename Dialog ——— */
export function RenameDialog({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const renameProject = useProjectStore((s) => s.renameProject);
  const [name, setName] = useState(project?.name ?? "");

  // Update name when project or dialog open state changes
  useEffect(() => {
    if (project && open) {
      // eslint-disable-next-line
      setName(project.name);
    }
  }, [project, open]);

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-4 mt-0">
        Rename Project
      </h2>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all mb-5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            renameProject(project.id, name.trim());
            onClose();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (name.trim()) {
              renameProject(project.id, name.trim());
              onClose();
            }
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark transition-colors cursor-pointer border-none"
        >
          Rename
        </button>
      </div>
    </Modal>
  );
}

/* ——— Delete Confirmation ——— */
export function DeleteDialog({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const deleteProject = useProjectStore((s) => s.deleteProject);

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-2 mt-0">
        Delete Project
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Are you sure you want to delete{" "}
        <strong className="text-text-primary">{project.name}</strong>? This
        action cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            deleteProject(project.id);
            onClose();
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-status-error hover:bg-red-600 transition-colors cursor-pointer border-none"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}

/* ——— Edit Details Dialog ——— */
export function EditDetailsDialog({
  isOpen,
  onOpenChange,
  projectId,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
}) {
  const { projects, updateProject } = useProjectStore();
  const project = projects.find((p) => p.id === projectId);

  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [language, setLanguage] = useState(project?.languages?.[0] ?? "");

  // Update state when project changes or dialog opens
  useEffect(() => {
    if (project && isOpen) {
      // eslint-disable-next-line
      setName(project.name);
      setDescription(project.description ?? "");
      setLanguage(project.languages?.[0] ?? "");
    }
  }, [project, isOpen]);

  if (!project) return null;

  const handleSave = () => {
    updateProject(project.id, {
      name: name.trim() || project.name,
      description: description.trim() || null,
      languages: language.trim() ? [language.trim()] : project.languages,
    });
    onOpenChange(false);
  };

  return (
    <Modal open={isOpen} onClose={() => onOpenChange(false)}>
      <h2 className="text-lg font-semibold text-text-primary mb-5 mt-0">
        Edit Project Details
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Language
          </label>
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={() => onOpenChange(false)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark transition-colors cursor-pointer border-none"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
