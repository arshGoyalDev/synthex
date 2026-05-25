import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Github,
  UploadCloud,
  Layers,
  TerminalSquare,
  Package,
  ArrowLeft,
  CheckCircle2,
  FileArchive,
  Wand2,
  Settings2,
} from "lucide-react";
import { LANGUAGES, TEMPLATES } from "@synthex/templates";
import {
  createProject,
  type CreateProjectPayload,
} from "../../services/project.service";
import {
  detectGithubRepo,
  importFromGithub,
  importFromZip,
  listGithubRepos,
  uploadZip,
  detectZip,
  type GithubRepoInfo,
} from "../../services/import.service";
import { Input } from "../../components/ui/Input";

type CreationMode =
  | "github"
  | "zip"
  | "template"
  | "blank"
  | "raw";

export const Route = createFileRoute("/project/")({
  component: CreateProjectPage,
});

function CreateProjectPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateList = useMemo(() => Object.values(TEMPLATES), []);
  const languageList = useMemo(() => Object.values(LANGUAGES), []);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [repoUrl, setRepoUrl] = useState("");
  const [repoBranch, setRepoBranch] = useState("");
  const [repos, setRepos] = useState<GithubRepoInfo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [overrideLanguage, setOverrideLanguage] = useState<string>("");
  const [installCommand, setInstallCommand] = useState("");
  const [runCommand, setRunCommand] = useState("");

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);
  const [detectedRun, setDetectedRun] = useState<string | null>(null);
  const [detectedInstall, setDetectedInstall] = useState<string | null>(null);
  const [detectedPreview, setDetectedPreview] = useState<string | null>(null);
  const [detectedPort, setDetectedPort] = useState<number | null>(null);

  const loadRepos = async () => {
    try {
      setBusy(true);
      setError(null);
      const data = await listGithubRepos();
      setRepos(data);
      setRepoPickerOpen(true);
    } catch (err) {
      console.error(err);
      setError("Unable to load GitHub repos. Connect GitHub first.");
    } finally {
      setBusy(false);
    }
  };

  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return repos;
    const q = repoSearch.toLowerCase();
    return repos.filter((r) =>
      r.fullName.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q),
    );
  }, [repos, repoSearch]);

  useEffect(() => {
    if (!zipFile) return;
    if (!projectName.trim()) {
      const name = zipFile.name.replace(/\.zip$/i, "");
      setProjectName(name);
    }
  }, [zipFile]);

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const handleZipSelection = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Please upload a .zip file.");
      return;
    }
    setError(null);
    setMode("zip");
    setZipFile(file);
    setOverrideLanguage("");
    setRunCommand("");
    setInstallCommand("");
  };

  const handleGithubDetect = async () => {
    if (!repoUrl.trim()) {
      setError("Repository URL is required.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const result = await detectGithubRepo(repoUrl);
      setProjectName((current) => current || result.name);
      setProjectDescription(result.description ?? "");
      setRepoBranch(result.repoBranch || "main");
      setDetectedLanguages(result.languages ?? []);
      setDetectedRun(result.runCommand ?? null);
      setDetectedInstall(result.installCommand ?? null);
      setDetectedPreview(result.previewCommand ?? null);
      setDetectedPort(result.port ?? null);
      if (!runCommand) setRunCommand(result.runCommand ?? "");
      if (!installCommand) setInstallCommand(result.installCommand ?? "");
    } catch (err) {
      console.error(err);
      setError("Failed to detect repository config.");
    } finally {
      setBusy(false);
    }
  };

  const handleGithubImport = async () => {
    if (!repoUrl.trim()) {
      setError("Repository URL is required.");
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const detect = await detectGithubRepo(repoUrl);
      const languageDefaults = overrideLanguage
        ? LANGUAGES[overrideLanguage]
        : null;
      const fallbackRun =
        runCommand ||
        languageDefaults?.runCommand ||
        detect.runCommand ||
        undefined;
      const fallbackInstall =
        installCommand || detect.installCommand || undefined;

      const project = await importFromGithub(repoUrl, repoBranch || detect.repoBranch, {
        name: projectName || detect.name,
        description: projectDescription || detect.description,
        runCommand: fallbackRun,
        previewCommand: detect.previewCommand ?? undefined,
        previewPort: detect.port ?? undefined,
        installCommand: fallbackInstall,
        isPreview: detect.isPreview ?? false,
        languages: overrideLanguage ? [overrideLanguage] : detect.languages ?? [],
      });
      navigate({ to: `/project/${project.id}` });
    } catch (err) {
      console.error(err);
      setError("Failed to import GitHub project.");
    } finally {
      setBusy(false);
    }
  };

  const handleZipImport = async () => {
    if (!zipFile) return;
    try {
      setBusy(true);
      setError(null);
      const uploaded = await uploadZip(zipFile, (pct) => setZipProgress(pct));
      const detection = await detectZip(
        uploaded.filePaths,
        uploaded.fileContents,
      );
      setDetectedLanguages(detection.languages ?? []);
      setDetectedRun(detection.runCommand ?? null);
      setDetectedInstall(detection.installCommand ?? null);
      setDetectedPreview(detection.previewCommand ?? null);
      setDetectedPort(detection.port ?? null);
      if (!runCommand) setRunCommand(detection.runCommand ?? "");
      if (!installCommand) setInstallCommand(detection.installCommand ?? "");

      const languageDefaults = overrideLanguage
        ? LANGUAGES[overrideLanguage]
        : null;
      const fallbackRun =
        runCommand ||
        languageDefaults?.runCommand ||
        detection.runCommand ||
        undefined;
      const fallbackInstall =
        installCommand || detection.installCommand || undefined;

      const project = await importFromZip(uploaded.zipKey, {
        name: projectName || uploaded.originalName,
        description: projectDescription || undefined,
        runCommand: fallbackRun,
        previewCommand: detection.previewCommand ?? undefined,
        previewPort: detection.port ?? undefined,
        installCommand: fallbackInstall,
        isPreview: detection.isPreview ?? false,
        languages: overrideLanguage ? [overrideLanguage] : detection.languages ?? [],
      });
      navigate({ to: `/project/${project.id}` });
    } catch (err) {
      console.error(err);
      setError("Failed to import ZIP project.");
    } finally {
      setBusy(false);
      setZipProgress(null);
    }
  };

  const handleTemplateCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) {
      setError("Project name is required.");
      return;
    }
    const payload: CreateProjectPayload = {
      name: projectName,
      description: projectDescription || undefined,
      type: "template",
      template: selectedTemplate,
    };
    await createAndNavigate(payload);
  };

  const handleBlankCreate = async () => {
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }
    const payload: CreateProjectPayload = {
      name: projectName,
      description: projectDescription || undefined,
      type: "blank",
      languages: selectedLanguages,
    };
    await createAndNavigate(payload);
  };

  const handleRawCreate = async () => {
    if (!projectName.trim()) {
      setError("Project name is required.");
      return;
    }
    const payload: CreateProjectPayload = {
      name: projectName,
      description: projectDescription || undefined,
      type: "raw",
    };
    await createAndNavigate(payload);
  };

  const createAndNavigate = async (payload: CreateProjectPayload) => {
    try {
      setBusy(true);
      setError(null);
      const project = await createProject(payload);
      navigate({ to: `/project/${project.id}` });
    } catch (err) {
      console.error(err);
      setError("Failed to create project.");
    } finally {
      setBusy(false);
    }
  };

  const heroSubtitle =
    "Choose an import path or spin up a fresh workspace. Minimal setup, maximum control.";

  return (
    <div
      className="min-h-screen bg-bg-primary text-text-primary"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) {
          setIsDragActive(false);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        const file = event.dataTransfer.files?.[0] ?? null;
        handleZipSelection(file);
      }}
    >
      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="max-w-md w-[90%] rounded-2xl border border-dashed border-accent-primary/60 bg-bg-secondary/90 p-8 text-center shadow-2xl">
            <UploadCloud className="mx-auto text-accent-primary" size={28} />
            <h3 className="text-lg font-semibold mt-3">Drop ZIP to import</h3>
            <p className="text-xs text-text-tertiary mt-2">
              Release to upload and auto-detect your project.
            </p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/" })}
              className="w-9 h-9 rounded-lg border border-border-subtle bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-text-tertiary m-0">
                Create Project
              </p>
              <h1 className="text-2xl font-semibold mt-1">Start a new workspace</h1>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-accent-primary/60" />
            Private GitHub import supported
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8">
          <section className="space-y-5">
            <div className="rounded-2xl border border-border-subtle bg-bg-secondary/70 p-6 shadow-[0_0_100px_rgba(22,163,74,0.08)]">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="text-xl font-semibold m-0">Choose your origin</h2>
                  <p className="text-sm text-text-tertiary mt-2 max-w-xl">
                    {heroSubtitle}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs text-text-tertiary">
                  <Wand2 size={14} />
                  Auto-detection included
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <ActionCard
                  active={mode === "github"}
                  icon={<Github size={18} />}
                  title="Import from GitHub"
                  description="Public or private repos via OAuth."
                  onClick={() => setMode("github")}
                />
                <ActionCard
                  active={mode === "zip"}
                  icon={<UploadCloud size={18} />}
                  title="Upload ZIP"
                  description="Drop a zip file and auto-detect settings."
                  onClick={() => setMode("zip")}
                />
                <ActionCard
                  active={mode === "template"}
                  icon={<Layers size={18} />}
                  title="Template starter"
                  description="Curated stacks with sensible defaults."
                  onClick={() => setMode("template")}
                />
                <ActionCard
                  active={mode === "blank"}
                  icon={<Package size={18} />}
                  title="Blank environment"
                  description="Select languages, start clean."
                  onClick={() => setMode("blank")}
                />
                <ActionCard
                  active={mode === "raw"}
                  icon={<TerminalSquare size={18} />}
                  title="Raw machine"
                  description="No scaffolding. Total freedom."
                  onClick={() => setMode("raw")}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-secondary/50 p-6">
              <h3 className="text-lg font-semibold m-0">Project details</h3>
              <p className="text-sm text-text-tertiary mt-2">
                Set a name and optional description. We will reuse it for imports.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Project Name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="synthex-studio"
                />
                <div className="space-y-1.5">
                   <Input
                  label="Project Description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Optional"
                />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-6">
              <h3 className="text-lg font-semibold m-0">Configure & create</h3>
              <p className="text-sm text-text-tertiary mt-2">
                Follow the instructions for your selected path.
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
                  {error}
                </div>
              )}

              {!mode && (
                <EmptyState />
              )}

              {mode === "github" && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-border-subtle bg-bg-primary p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold m-0">GitHub Import</h4>
                        <p className="text-xs text-text-tertiary mt-1">
                          Paste a repo URL or pick from your connected account.
                        </p>
                      </div>
                      <button
                        onClick={loadRepos}
                        className="text-xs text-accent-primary hover:text-accent-secondary transition-colors"
                      >
                        Browse repos
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <Input
                        label="Repository URL"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/you/project"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                        <Input
                          label="Branch"
                          value={repoBranch}
                          onChange={(e) => setRepoBranch(e.target.value)}
                          placeholder="main"
                        />
                        <div className="flex items-end gap-2">
                          <button
                            onClick={handleGithubDetect}
                            disabled={!repoUrl || busy}
                            className="px-4 py-2 rounded-lg border border-border-subtle bg-bg-tertiary text-xs font-semibold text-text-primary hover:bg-bg-tertiary/70 disabled:opacity-60"
                          >
                            Detect
                          </button>
                          <button
                            onClick={handleGithubImport}
                            disabled={!repoUrl || busy}
                            className="px-4 py-2 border border-transparent rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-secondary disabled:opacity-60"
                          >
                            Import
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {repoPickerOpen && (
                    <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          value={repoSearch}
                          onChange={(e) => setRepoSearch(e.target.value)}
                          placeholder="Search your repos"
                          className="flex-1 bg-bg-secondary border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary"
                        />
                        <button
                          onClick={() => setRepoPickerOpen(false)}
                          className="text-xs text-text-tertiary hover:text-text-primary"
                        >
                          Close
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {filteredRepos.map((repo) => (
                          <button
                            key={repo.id}
                            onClick={() => {
                              setRepoUrl(repo.htmlUrl);
                              setRepoBranch(repo.defaultBranch);
                              setRepoPickerOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg border border-border-subtle hover:border-accent-primary/60 hover:bg-bg-tertiary transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-text-primary">
                                {repo.fullName}
                              </span>
                              <span className="text-[10px] text-text-tertiary">
                                {repo.private ? "Private" : "Public"}
                              </span>
                            </div>
                            {repo.description && (
                              <p className="text-[11px] text-text-tertiary mt-1">
                                {repo.description}
                              </p>
                            )}
                          </button>
                        ))}
                        {filteredRepos.length === 0 && (
                          <p className="text-xs text-text-tertiary">No repos found.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4">
                    <div className="flex items-center gap-2 text-xs text-text-tertiary mb-3">
                      <Settings2 size={14} />
                      Override detected config
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <SelectField
                        label="Primary Language"
                        value={overrideLanguage}
                        options={languageList.map((lang) => ({
                          value: lang.id,
                          label: lang.name,
                        }))}
                        placeholder="Auto-detect"
                        onChange={(value) => {
                          setOverrideLanguage(value);
                          const defaults = LANGUAGES[value];
                          setRunCommand(defaults?.runCommand ?? "");
                          setInstallCommand("");
                        }}
                      />
                      <Input
                        label="Install Command"
                        value={installCommand}
                        onChange={(e) => setInstallCommand(e.target.value)}
                        placeholder={detectedInstall ?? "npm install"}
                      />
                      <Input
                        label="Run Command"
                        value={runCommand}
                        onChange={(e) => setRunCommand(e.target.value)}
                        placeholder={detectedRun ?? "npm run dev"}
                      />
                    </div>
                  </div>
                </div>
              )}

              {mode === "zip" && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-dashed border-border-subtle bg-bg-primary p-4 text-center">
                    <FileArchive className="mx-auto text-text-tertiary" size={22} />
                    <p className="text-xs text-text-tertiary mt-2">
                      Drop a zip file or choose from your device
                    </p>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => handleZipSelection(e.target.files?.[0] ?? null)}
                      className="mt-3 text-xs"
                    />
                    {zipFile && (
                      <p className="text-xs text-text-secondary mt-2">
                        {zipFile.name}
                      </p>
                    )}
                    {zipProgress !== null && (
                      <div className="mt-3 w-full h-2 rounded-full bg-bg-secondary">
                        <div
                          className="h-2 rounded-full bg-accent-primary"
                          style={{ width: `${zipProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleZipImport}
                    disabled={!zipFile || busy}
                    className="w-full px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-secondary disabled:opacity-60"
                  >
                    Import ZIP project
                  </button>

                  <div className="rounded-2xl border border-border-subtle bg-bg-primary p-4">
                    <div className="flex items-center gap-2 text-xs text-text-tertiary mb-3">
                      <Settings2 size={14} />
                      Override detected config
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <SelectField
                        label="Primary Language"
                        value={overrideLanguage}
                        options={languageList.map((lang) => ({
                          value: lang.id,
                          label: lang.name,
                        }))}
                        placeholder="Auto-detect"
                        onChange={(value) => {
                          setOverrideLanguage(value);
                          const defaults = LANGUAGES[value];
                          setRunCommand(defaults?.runCommand ?? "");
                          setInstallCommand("");
                        }}
                      />
                      <Input
                        label="Install Command"
                        value={installCommand}
                        onChange={(e) => setInstallCommand(e.target.value)}
                        placeholder={detectedInstall ?? "npm install"}
                      />
                      <Input
                        label="Run Command"
                        value={runCommand}
                        onChange={(e) => setRunCommand(e.target.value)}
                        placeholder={detectedRun ?? "npm run dev"}
                      />
                    </div>
                  </div>
                </div>
              )}

              {mode === "template" && (
                <div className="mt-5 space-y-4">
                  <SelectField
                    label="Template"
                    value={selectedTemplate ?? ""}
                    options={templateList.map((tpl) => ({
                      value: tpl.id,
                      label: tpl.name,
                    }))}
                    placeholder="Select a template"
                    onChange={(value) => setSelectedTemplate(value || null)}
                  />
                  <button
                    onClick={handleTemplateCreate}
                    disabled={!selectedTemplate || !projectName || busy}
                    className="w-full px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-secondary disabled:opacity-60"
                  >
                    Create from template
                  </button>
                </div>
              )}

              {mode === "blank" && (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {languageList.map((lang) => (
                      <button
                        key={lang.id}
                        onClick={() => {
                          setSelectedLanguages((current) =>
                            current.includes(lang.id)
                              ? current.filter((id) => id !== lang.id)
                              : [...current, lang.id],
                          );
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          selectedLanguages.includes(lang.id)
                            ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                            : "border-border-subtle text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleBlankCreate}
                    disabled={!projectName || selectedLanguages.length === 0 || busy}
                    className="w-full px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-secondary disabled:opacity-60"
                  >
                    Create blank environment
                  </button>
                </div>
              )}

              {mode === "raw" && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-lg border border-border-subtle bg-bg-primary p-3 text-xs text-text-tertiary">
                    Raw projects spin up an empty workspace without scaffolding.
                    Use this when you want full control over setup.
                  </div>
                  <button
                    onClick={handleRawCreate}
                    disabled={!projectName || busy}
                    className="w-full px-3 py-2 rounded-lg bg-accent-primary text-white text-xs font-semibold hover:bg-accent-secondary disabled:opacity-60"
                  >
                    Create raw workspace
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border-subtle bg-bg-secondary/70 p-5">
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <CheckCircle2 size={14} />
                Imports automatically detect run, install commands, and ports.
              </div>
              <div className="flex items-center gap-2 text-xs text-text-tertiary mt-2">
                <CheckCircle2 size={14} />
                You can edit runtime config later from project settings.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-4 transition-all ${
        active
          ? "border-accent-primary bg-accent-primary/10"
          : "border-border-subtle bg-bg-primary hover:border-accent-primary/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-lg bg-bg-tertiary flex items-center justify-center text-text-secondary">
          {icon}
        </div>
        {active && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-accent-primary">
            Selected
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold mt-3 mb-1 text-text-primary">
        {title}
      </h4>
      <p className="text-xs text-text-tertiary leading-relaxed m-0">
        {description}
      </p>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-border-subtle bg-bg-primary p-6 text-center">
      <UploadCloud className="mx-auto text-text-tertiary" size={20} />
      <p className="text-xs text-text-tertiary mt-2">
        Select an option on the left to configure your project.
      </p>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-text-secondary block">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-secondary border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
