import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProjectStore } from "../../stores/project.store";
import { Modal } from "./ProjectDialogs";
import { IconCode } from "../icons";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { projects } = useProjectStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filteredProjects = projects.filter(
    (p) =>
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.description?.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredProjects.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredProjects[selectedIndex]) {
        navigate({ to: `/project/${filteredProjects[selectedIndex].id}` });
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={() => setOpen(false)} className="bg-bg-secondary border border-border-default rounded-xl w-full max-w-xl shadow-2xl shadow-black/50 overflow-hidden transform transition-all animate-fade-in mt-[-10vh]">
      <div className="flex items-center px-4 py-3 border-b border-border-subtle bg-bg-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary mr-3">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search projects... (Cmd+K)"
          className="flex-1 bg-transparent border-none text-text-primary text-base focus:outline-none placeholder-text-tertiary"
        />
        <div className="text-[10px] text-text-tertiary font-mono uppercase bg-surface-elevated px-1.5 py-0.5 rounded border border-border-subtle">Esc</div>
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {filteredProjects.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-tertiary">
            No projects found.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredProjects.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => {
                  navigate({ to: `/project/${p.id}` });
                  setOpen(false);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors cursor-pointer border-none ${
                  selectedIndex === idx
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "bg-transparent text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                }`}
              >
                <div className={`flex items-center justify-center w-8 h-8 rounded-md bg-surface-elevated flex-shrink-0 ${selectedIndex === idx ? "text-accent-primary border border-accent-primary/30" : "text-text-tertiary border border-border-subtle"}`}>
                  <IconCode size={16} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{p.name}</span>
                  {p.description && (
                    <span className="text-xs text-text-tertiary truncate opacity-80">{p.description}</span>
                  )}
                </div>
                {p.isPinned && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-primary ml-2 flex-shrink-0">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
