import { useEffect, useState } from "react";
import { Modal } from "../dashboard/ProjectDialogs";
import { Input } from "../ui/Input";
import type { Project } from "../../types/project";
import { Settings, Terminal, Database, Edit3 } from "lucide-react";

interface ProjectSettingsModalProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description: string | null;
    installCommand: string | null;
    runCommand: string | null;
    previewCommand: string | null;
    previewPort: number | null;
    envVars: Record<string, string> | null;
    autoSaveEnabled: boolean;
  }) => Promise<void>;
}

const envObjectToText = (envVars: Record<string, string> | null | undefined) =>
  Object.entries(envVars ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseEnvVars = (value: string): Record<string, string> | null => {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const envVars: Record<string, string> = {};
  for (const line of lines) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid env var: "${line}"`);
    }

    const key = line.slice(0, separatorIndex).trim();
    const valuePart = line.slice(separatorIndex + 1);

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env var key: "${key}"`);
    }

    envVars[key] = valuePart;
  }

  return envVars;
};

type SettingsTab = "general" | "commands" | "environment" | "editor";

export function ProjectSettingsModal({
  open,
  project,
  onClose,
  onSave,
}: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [runCommand, setRunCommand] = useState("");
  const [previewCommand, setPreviewCommand] = useState("");
  const [previewPort, setPreviewPort] = useState("");
  const [envVarsText, setEnvVarsText] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!project || !open) return;

    setName(project.name);
    setDescription(project.description ?? "");
    setInstallCommand(project.installCommand ?? "");
    setRunCommand(project.runCommand ?? "");
    setPreviewCommand(project.previewCommand ?? "");
    setPreviewPort(project.previewPort ? String(project.previewPort) : "");
    setEnvVarsText(envObjectToText(project.envVars));
    setAutoSaveEnabled(project.autoSaveEnabled ?? true);
    setErrorMessage(null);
    setActiveTab("general");
  }, [open, project]);

  if (!project) return null;

  const handleSave = async () => {
    if (isSaving) return;

    const nextName = name.trim();
    if (nextName.length < 2) {
      setErrorMessage("Project name must be at least 2 characters.");
      return;
    }

    let parsedEnvVars: Record<string, string> | null;
    try {
      parsedEnvVars = parseEnvVars(envVarsText);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Invalid environment variables.",
      );
      return;
    }

    const normalizedPreviewPort = previewPort.trim()
      ? Number(previewPort)
      : null;

    if (
      normalizedPreviewPort !== null &&
      (!Number.isInteger(normalizedPreviewPort) || normalizedPreviewPort <= 0)
    ) {
      setErrorMessage("Preview port must be a positive integer.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onSave({
        name: nextName,
        description: normalizeText(description),
        installCommand: normalizeText(installCommand),
        runCommand: normalizeText(runCommand),
        previewCommand: normalizeText(previewCommand),
        previewPort: normalizedPreviewPort,
        envVars: parsedEnvVars,
        autoSaveEnabled,
      });
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save project settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
    { id: "commands", label: "Commands", icon: <Terminal className="w-4 h-4" /> },
    { id: "environment", label: "Environment", icon: <Database className="w-4 h-4" /> },
    { id: "editor", label: "Editor", icon: <Edit3 className="w-4 h-4" /> },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="bg-bg-secondary border border-border-default rounded-xl w-full max-w-4xl shadow-2xl shadow-black/40 animate-slide-up overflow-hidden flex flex-col h-[600px]"
    >
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-48 bg-bg-tertiary border-r border-border-default flex flex-col">
          <div className="p-4 border-b border-border-default">
            <h2 className="text-sm font-semibold text-text-primary">
              Project Settings
            </h2>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-l-2 ${
                  activeTab === tab.id
                    ? "bg-surface-overlay text-accent-primary border-accent-primary"
                    : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary border-transparent"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full bg-bg-primary">
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-xl font-semibold text-text-primary mb-6">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>

            {activeTab === "general" && (
              <div className="space-y-6 max-w-xl">
                <Input
                  label="Project Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="synthex-studio"
                />
                
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary block">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="What is this project about?"
                    className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm resize-none"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    A brief description of your project.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "commands" && (
              <div className="space-y-6 max-w-xl">
                <div className="space-y-1.5">
                  <Input
                    label="Install Command"
                    value={installCommand}
                    onChange={(e) => setInstallCommand(e.target.value)}
                    placeholder="npm install"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    The command to run to install dependencies.
                  </p>
                </div>
                
                <div className="space-y-1.5">
                  <Input
                    label="Run Command"
                    value={runCommand}
                    onChange={(e) => setRunCommand(e.target.value)}
                    placeholder="npm run dev"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    The command to start the development server.
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Input
                      label="Preview Command"
                      value={previewCommand}
                      onChange={(e) => setPreviewCommand(e.target.value)}
                      placeholder="npm run preview"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary block">
                      Preview Port
                    </label>
                    <input
                      value={previewPort}
                      onChange={(e) => setPreviewPort(e.target.value)}
                      inputMode="numeric"
                      placeholder="3000"
                      className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "environment" && (
              <div className="space-y-6 max-w-xl">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary block">
                    Environment Variables
                  </label>
                  <textarea
                    value={envVarsText}
                    onChange={(e) => setEnvVarsText(e.target.value)}
                    rows={10}
                    placeholder={"API_URL=https://example.com\nNODE_ENV=development"}
                    className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm font-mono resize-none whitespace-pre"
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    Define environment variables, one per line (KEY=value).
                  </p>
                </div>
              </div>
            )}

            {activeTab === "editor" && (
              <div className="space-y-6 max-w-xl">
                <label className="flex items-start justify-between rounded-xl border border-border-default bg-bg-primary px-4 py-4 cursor-pointer hover:border-text-tertiary transition-colors">
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      Auto-save
                    </div>
                    <div className="text-xs text-text-tertiary mt-1.5 max-w-[80%]">
                      Automatically save dirty files after you stop typing. When disabled, you'll need to save files manually.
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoSaveEnabled}
                    onClick={() => setAutoSaveEnabled((current) => !current)}
                    className={`relative flex items-center justify-center h-6 w-11 rounded-full border-none transition-colors shrink-0 mt-0.5 ${
                      autoSaveEnabled ? "bg-accent-primary" : "bg-bg-tertiary"
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm ${
                        autoSaveEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>
              </div>
            )}
          </div>

          {/* Footer Area */}
          <div className="border-t border-border-default p-4 bg-bg-tertiary/50 flex items-center justify-between">
            <div className="text-sm text-status-error font-medium px-2">
              {errorMessage}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark transition-colors cursor-pointer border-none disabled:opacity-60 min-w-[120px]"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
