import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../stores/auth.store";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconPlus,
  IconEdit,
  IconLogout,
} from "../icons";

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  const navItems = [
    { icon: <IconCode size={18} />, label: "Projects", active: true },
    { icon: <IconPlus size={18} />, label: "Activity", active: false },
    { icon: <IconEdit size={18} />, label: "Settings", active: false },
  ];

  return (
    <aside
      className="h-screen flex flex-col bg-bg-dark border-r border-border-subtle transition-all duration-300 relative flex-shrink-0"
      style={{ width: collapsed ? 68 : 240 }}
    >
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-surface-elevated border border-border-default shadow-sm flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-card-hover transition-colors cursor-pointer"
      >
        {collapsed ? (
          <IconChevronRight size={14} />
        ) : (
          <IconChevronLeft size={14} />
        )}
      </button>

      {/* Workspace Header */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0 mt-2">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-accent-primary to-accent-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-primary/20">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-text-primary tracking-tight whitespace-nowrap truncate">
              {user?.username ? `${user.username}'s Workspace` : "My Workspace"}
            </span>
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
              Free Plan
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-3 pt-6 pb-3 flex flex-col gap-1">
        {navItems.map((item, idx) => (
          <button
            key={idx}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border-none ${
              item.active
                ? "bg-accent-light/50 text-accent-primary"
                : "bg-transparent text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            {item.icon}
            {!collapsed && item.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* User Profile Footer */}
      <div className="p-3">
        <div
          className={`flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-overlay transition-colors mx-1 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border-default"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border-default flex items-center justify-center text-text-secondary font-semibold text-xs flex-shrink-0">
              {user?.username?.charAt(0).toUpperCase() ??
                user?.email?.charAt(0).toUpperCase() ??
                "?"}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate m-0 leading-tight">
                {user?.username ?? "User"}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-text-tertiary hover:text-status-error hover:bg-status-error-light transition-colors bg-transparent border-none cursor-pointer"
              title="Logout"
            >
              <IconLogout size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
