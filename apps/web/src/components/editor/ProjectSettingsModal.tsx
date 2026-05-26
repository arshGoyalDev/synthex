import { useEffect, useState } from "react";
import { Modal } from "../dashboard/ProjectDialogs";
import { Input } from "../ui/Input";
import type { Project } from "../../types/project";

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

export function ProjectSettingsModal({
  open,
  project,
  onClose,
  onSave,
}: ProjectSettingsModalProps) {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="bg-bg-secondary border border-border-default rounded-2xl p-6 w-full max-w-2xl shadow-2xl shadow-black/40 animate-slide-up"
    >
      <h2 className="text-lg font-semibold text-text-primary mb-1 mt-0">
        Project Settings
      </h2>
      <p className="text-sm text-text-tertiary mt-0 mb-5">
        Update project metadata, runtime commands, and editor behavior.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="synthex-studio"
        />
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

      <div className="mt-4 space-y-1.5">
        <label className="text-sm font-medium text-text-secondary block">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What is this project about?"
          className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm resize-none"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Install Command"
          value={installCommand}
          onChange={(e) => setInstallCommand(e.target.value)}
          placeholder="npm install"
        />
        <Input
          label="Run Command"
          value={runCommand}
          onChange={(e) => setRunCommand(e.target.value)}
          placeholder="npm run dev"
        />
        <Input
          label="Preview Command"
          value={previewCommand}
          onChange={(e) => setPreviewCommand(e.target.value)}
          placeholder="npm run dev"
        />
      </div>

      <div className="mt-4 space-y-1.5">
        <label className="text-sm font-medium text-text-secondary block">
          Environment Variables
        </label>
        <textarea
          value={envVarsText}
          onChange={(e) => setEnvVarsText(e.target.value)}
          rows={6}
          placeholder={"API_URL=https://example.com\nNODE_ENV=development"}
          className="w-full bg-bg-primary border border-border-default rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm font-mono resize-none"
        />
      </div>

      <label className="mt-5 flex items-center justify-between rounded-xl border border-border-default bg-bg-primary px-4 py-3 cursor-pointer">
        <div>
          <div className="text-sm font-medium text-text-primary">
            Auto-save
          </div>
          <div className="text-xs text-text-tertiary mt-1">
            Save dirty files automatically after edits.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoSaveEnabled}
          onClick={() => setAutoSaveEnabled((current) => !current)}
          className={`relative flex items-center justify-center h-6 w-12 rounded-full border-none transition-colors ${
            autoSaveEnabled ? "bg-accent-primary" : "bg-bg-tertiary"
          }`}
        >
          <span
            className={`absolute left-0 h-4 w-4 rounded-full bg-white transition-transform ${
              autoSaveEnabled ? "translate-x-6.5" : "translate-x-1.5"
            }`}
          />
        </button>
      </label>

      {errorMessage && (
        <p className="mt-4 mb-0 text-sm text-status-error">{errorMessage}</p>
      )}

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark transition-colors cursor-pointer border-none disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </Modal>
  );
}
