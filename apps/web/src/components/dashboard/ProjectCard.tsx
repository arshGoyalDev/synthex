import React, { useState, useRef, useEffect } from "react";
import type { Project } from "../../types/project";
import { IconDots, IconEdit, IconPin, IconTrash, IconCode } from "../icons";
import { TEMPLATES } from "@synthex/types";

/* ——— Language → colour mapping ——— */
const LANG_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  typescript: { bg: "#1e3a5f", text: "#60a5fa", accent: "#3b82f6" },
  javascript: { bg: "#4a3f1f", text: "#fbbf24", accent: "#f59e0b" },
  python: { bg: "#1e3a3a", text: "#34d399", accent: "#10b981" },
  go: { bg: "#1a3040", text: "#67e8f9", accent: "#06b6d4" },
  rust: { bg: "#3b2020", text: "#f87171", accent: "#ef4444" },
  java: { bg: "#3b2a1a", text: "#fb923c", accent: "#f97316" },
  csharp: { bg: "#2e1e4a", text: "#c084fc", accent: "#a855f7" },
  cpp: { bg: "#2e1e4a", text: "#c084fc", accent: "#a855f7" },
  ruby: { bg: "#3b1a1a", text: "#fca5a5", accent: "#ef4444" },
  php: { bg: "#2a2040", text: "#a78bfa", accent: "#8b5cf6" },
};

const DEFAULT_LANG = { bg: "#1a1a2e", text: "#a1a1aa", accent: "#71717a" };

function getLang(lang?: string | string[]) {
  if (!lang) return DEFAULT_LANG;
  const mainLang = Array.isArray(lang) ? lang[0] : lang;
  if (!mainLang || typeof mainLang !== 'string') return DEFAULT_LANG;
  return LANG_COLORS[mainLang.toLowerCase()] ?? DEFAULT_LANG;
}

/* ——— Relative-time helper ——— */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function MenuBtn({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm bg-transparent border-none cursor-pointer transition-colors ${
        danger
          ? "text-status-error hover:bg-status-error-light"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ProjectMenu({
  project,
  onDelete,
  onTogglePin,
  onEdit,
}: {
  project: Project;
  onDelete: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-colors bg-transparent border-none cursor-pointer"
      >
        <IconDots size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 bg-bg-secondary border border-border-default rounded-xl shadow-xl shadow-black/30 py-1.5 z-50 animate-fade-in"
          style={{ animationDuration: "0.15s" }}
        >
          <MenuBtn
            icon={<IconEdit />}
            label="Edit Details"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
          />
          <MenuBtn
            icon={<IconPin size={16} filled={project.isPinned} />}
            label={project.isPinned ? "Unpin" : "Pin"}
            onClick={() => {
              onTogglePin();
              setOpen(false);
            }}
          />
          <div className="my-1 border-t border-border-subtle" />
          <MenuBtn
            icon={<IconTrash />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ProjectCard({
  project,
  onDelete,
  onTogglePin,
  onEdit,
  onClick,
}: {
  project: Project;
  onDelete: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onClick: () => void;
}) {
  const lang = getLang(project.languages);

  let badgeText = "RAW";
  if (project.type === "template" && project.template) {
    badgeText = TEMPLATES[project.template].name.toUpperCase();
  } else if (project.type === "blank" && project.languages && project.languages.length > 0) {
    badgeText = project.languages.length > 2 
      ? `${project.languages.slice(0, 2).map(l => l.toUpperCase()).join(", ")} +${project.languages.length - 2}`
      : project.languages.map(l => l.toUpperCase()).join(", ");
  }

  return (
    <div 
      onClick={onClick}
      className="group bg-bg-secondary border border-border-default rounded-xl hover:border-border-focus hover:shadow-xl hover:shadow-black/40 transition-all duration-300 cursor-pointer flex flex-col relative"
    >
      <div 
        className="absolute -top-0.5 left-0 right-0 rounded-t-xl h-20 opacity-70 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: lang.accent }}
      />
      <div className="h-28 rounded-t-xl flex items-center justify-center bg-bg-dark relative overflow-hidden border-b border-border-subtle">
        <div 
          className="absolute inset-0 opacity-15 mix-blend-screen transition-opacity duration-300 group-hover:opacity-25"
          style={{ background: `radial-gradient(circle at 50% 120%, ${lang.accent} 0%, transparent 70%)` }}
        />
        <div 
          className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-default flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300 z-10"
          style={{ color: lang.accent, borderColor: `${lang.accent}40` }}
        >
          <IconCode size={24} />
        </div>
        {project.isPinned && (
          <div className="absolute top-3 left-3 text-amber-500 z-10 drop-shadow-md">
            <IconPin size={14} filled />
          </div>
        )}
        <div
          className="absolute top-3 right-3 max-w-[140px] truncate px-2 py-0.5 rounded text-[10px] font-bold tracking-wider z-10 border shadow-sm backdrop-blur-md flex items-center justify-center transition-colors"
          style={{ color: lang.text, backgroundColor: `${lang.bg}90`, borderColor: `${lang.accent}30` }}
          title={project.languages?.join(", ") || project.template || "Raw"}
        >
          {badgeText}
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-1.5 bg-bg-secondary group-hover:bg-bg-card-hover rounded-b-xl transition-colors duration-300">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary truncate m-0 group-hover:text-white transition-colors">
            {project.name}
          </h3>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -mt-1 -mr-1">
            <ProjectMenu
              project={project}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onEdit={onEdit}
            />
          </div>
        </div>
        <p className="text-[13px] text-text-tertiary leading-snug line-clamp-2 m-0 flex-1">
          {project.description || <span className="italic opacity-50">No description</span>}
        </p>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] font-medium text-text-tertiary m-0 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lang.accent }} />
            {timeAgo(project.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
