import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useSocket } from "../../contexts/SocketContext";
import {
  getProjectById,
  getProjectEnvVars,
  startProject,
  stopProject,
  updateProject,
  updateProjectConfig,
} from "../../services/project.service";
import { useProjectStore } from "../../stores/project.store";
import { useSetupStore } from "../../stores/setup.store";
import type { Project } from "../../types/project";
import { useAuthStore } from "../../stores/auth.store";
import {
  Loader2,
  Play,
  AlertCircle,
  ChevronLeft,
  Monitor,
  RefreshCw,
} from "lucide-react";
import { EditorLayout } from "../../components/editor/EditorLayout";
import { FilePalette } from "../../components/editor/FilePalette";
import { useEditorStore } from "../../stores/editor.store";
import { useExecution } from "../../hooks/useExecution";
import { usePreview } from "../../hooks/usePreview";
import { ProjectSettingsModal } from "../../components/editor/ProjectSettingsModal";
import { SetupLogPanel } from "../../components/editor/SetupLogPanel";
import { InstallStatusBanner } from "../../components/editor/InstallStatusBanner";

export const Route = createFileRoute("/project/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const projects = useProjectStore((s) => s.projects);
  const updateProjectInStore = useProjectStore((s) => s.updateProject);

  const user = useAuthStore((s) => s.user);

  const [project, setProject] = useState<Project | null>(
    () => projects.find((p) => p.id === projectId) || null,
  );
  const [loading, setLoading] = useState(true);
  const [containerStatus, setContainerStatus] = useState<string>(
    project?.containerStatus || "unknown",
  );
  const [containerMsg, setContainerMsg] = useState<string>("");
  const currentStatusRef = useRef(project?.containerStatus || "unknown");
  const startRequestedRef = useRef(false);
  const restartAfterStoppedRef = useRef(false);
  const setProjectContext = useEditorStore((s) => s.setProjectContext);
  const resetEditorState = useEditorStore((s) => s.resetEditorState);
  const isRightPanelOpen = useEditorStore((s) => s.isRightPanelOpen);
  const toggleRightPanel = useEditorStore((s) => s.toggleRightPanel);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showSetupLogs, setShowSetupLogs] = useState(false);

  // ─── Setup store ────────────────────────────────────────────────────────────
  const setupStore = useSetupStore();
  const {
    initForProject,
    appendLog,
    applyStage,
    applyStatus,
    openEditorEarly,
    markInstallDone,
    reset: resetSetup,
  } = setupStore;

  // ─── Derived: when to show setup screen vs editor ───────────────────────────
  const isSettingUp =
    (containerStatus === "starting" ||
      containerStatus === "installing" ||
      containerStatus === "pending") &&
    !setupStore.openedEditorEarly;

  const showEditor =
    containerStatus === "ready" ||
    containerStatus === "installing" && setupStore.openedEditorEarly;

  const [runtimeConfig, setRuntimeConfig] = useState<{
    installCommand: string | null;
    runCommand: string | null;
    previewCommand: string | null;
    previewPort: number | null;
  }>(() => ({
    installCommand: project?.installCommand ?? null,
    runCommand: project?.runCommand ?? null,
    previewCommand: project?.previewCommand ?? null,
    previewPort: project?.previewPort ?? null,
  }));

  const [envVars, setEnvVars] = useState<Record<string, string> | null>(
    project?.envVars ?? null,
  );

  const templateId = project?.template ?? null;
  const runCommand = runtimeConfig.runCommand;
  const previewCommand = runtimeConfig.previewCommand;
  const previewPort = runtimeConfig.previewPort;

  // ─── Execution & Preview hooks ──────────────────────────────────────────────
  const projectName = project?.folderName || project?.name || "";
  const execution = useExecution(projectId, projectName);
  const preview = usePreview(projectId, projectName);

  const isPreviewProject = !!previewCommand && !!previewPort;
  const isExecutionActive =
    execution.status === "running" || execution.status === "queued";
  const isPreviewActive =
    preview.previewStatus === "ready" || preview.previewStatus === "starting";
  const isPanelActive = isPreviewProject ? isPreviewActive : isExecutionActive;

  // Disable run/preview while installing
  const isInstallRunning =
    containerStatus === "installing" && !setupStore.openedEditorEarly
      ? true
      : setupStore.isInstalling && setupStore.openedEditorEarly;

  const handlePanelButton = async () => {
    if (isRightPanelOpen) {
      toggleRightPanel();
      return;
    }
    toggleRightPanel();
    if (!isPanelActive) {
      if (isPreviewProject) {
        await preview.start(
          previewCommand!,
          previewPort!,
          templateId ?? undefined,
          envVars ?? undefined,
        );
      } else if (runCommand) {
        execution.clear();
        await execution.run(runCommand, { envVars: envVars ?? undefined });
      }
    }
  };

  const requestStart = async () => {
    startRequestedRef.current = true;
    const startData = await startProject(projectId);
    setContainerStatus(startData.status);
    currentStatusRef.current = startData.status;
    setRuntimeConfig((current) => ({
      installCommand: current.installCommand,
      runCommand: startData.runCommand ?? current.runCommand,
      previewCommand: startData.previewCommand ?? current.previewCommand,
      previewPort: startData.previewPort ?? current.previewPort,
    }));
    if (startData.message) {
      setContainerMsg(startData.message);
    }
    return startData;
  };

  // ─── Setup log socket subscriptions ─────────────────────────────────────────
  const joinedSetupRoomRef = useRef(false);

  const joinSetupRoom = useCallback(() => {
    if (!socket || joinedSetupRoomRef.current) return;
    socket.emit("setup:join", { projectId, fromSeq: 0 });
    joinedSetupRoomRef.current = true;
  }, [socket, projectId]);

  const leaveSetupRoom = useCallback(() => {
    if (!socket || !joinedSetupRoomRef.current) return;
    socket.emit("setup:leave", { projectId });
    joinedSetupRoomRef.current = false;
  }, [socket, projectId]);

  // Init setup store when project loads
  useEffect(() => {
    if (projectId) {
      initForProject(projectId);
    }
  }, [projectId, initForProject]);

  // Join setup room and subscribe to events
  useEffect(() => {
    if (!socket) return;

    joinSetupRoom();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onSetupLog = (data: any) => {
      if (data.projectId === projectId) {
        appendLog({
          projectId: data.projectId,
          seq: data.seq,
          type: data.type,
          text: data.text,
          timestamp: data.timestamp,
          commandIndex: data.commandIndex,
          totalCommands: data.totalCommands,
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onSetupStage = (data: any) => {
      if (data.projectId === projectId) {
        applyStage({
          projectId: data.projectId,
          stage: data.stage,
          stageName: data.stageName,
          commandIndex: data.commandIndex,
          totalCommands: data.totalCommands,
        });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onSetupStatus = (data: any) => {
      if (data.projectId === projectId) {
        applyStatus(data);
        if (data.status === "completed") {
          markInstallDone();
        }
      }
    };

    socket.on("setup:log", onSetupLog);
    socket.on("setup:stage", onSetupStage);
    socket.on("setup:status", onSetupStatus);

    return () => {
      socket.off("setup:log", onSetupLog);
      socket.off("setup:stage", onSetupStage);
      socket.off("setup:status", onSetupStatus);
      leaveSetupRoom();
    };
  }, [socket, projectId, appendLog, applyStage, applyStatus, markInstallDone, joinSetupRoom, leaveSetupRoom]);

  // Reset editor state when leaving the project
  useEffect(() => {
    return () => {
      resetEditorState();
      resetSetup();
    };
  }, [resetEditorState, resetSetup]);

  useEffect(() => {
    let isCancelled = false;

    async function initializeProject() {
      try {
        setLoading(true);
        let p = projects.find((x) => x.id === projectId);

        if (!p) {
          p = await getProjectById(projectId);
        }

        if (isCancelled) return;

        if (p) {
          setProject(p);
          setRuntimeConfig({
            installCommand: p.installCommand ?? null,
            runCommand: p.runCommand ?? null,
            previewCommand: p.previewCommand ?? null,
            previewPort: p.previewPort ?? null,
          });
          if (p.envVars !== undefined) {
            setEnvVars(p.envVars ?? null);
          } else {
            try {
              const envResult = await getProjectEnvVars(projectId);
              if (!isCancelled) {
                setEnvVars(envResult.envVars ?? null);
              }
            } catch (err) {
              console.error("Failed to fetch project env vars", err);
            }
          }
          const initialStatus = p.containerStatus || "unknown";
          setContainerStatus(initialStatus);
          currentStatusRef.current = initialStatus;
          setProjectContext(projectId, initialStatus);

          if (
            initialStatus !== "ready" &&
            initialStatus !== "starting" &&
            initialStatus !== "installing" &&
            initialStatus !== "stopping" &&
            initialStatus !== "pending" &&
            !startRequestedRef.current
          ) {
            try {
              await requestStart();
            } catch (err) {
              console.error("Failed to start project automatically:", err);
              if (axios.isAxiosError(err)) {
                const message =
                  (err.response?.data as { error?: string; message?: string })
                    ?.error ||
                  (err.response?.data as { error?: string; message?: string })
                    ?.message ||
                  err.message;
                setContainerStatus("error");
                setContainerMsg(message || "Failed to start container");
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch/initialize project", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    initializeProject();

    return () => {
      isCancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onContainerStatus = (data: any) => {
      if (data.projectId === projectId) {
        currentStatusRef.current = data.status;
        setContainerStatus(data.status);
        setProjectContext(projectId, data.status);
        if (data.message) {
          setContainerMsg(data.message);
        }
        setRuntimeConfig((current) => ({
          installCommand: current.installCommand,
          runCommand: data.runCommand ?? current.runCommand,
          previewCommand: data.previewCommand ?? current.previewCommand,
          previewPort: data.previewPort ?? current.previewPort,
        }));

        // When install completes (status → ready after installing), mark it done
        if (data.status === "ready" && setupStore.isInstalling) {
          markInstallDone();
        }

        if (data.status === "stopped" && !restartAfterStoppedRef.current) {
          restartAfterStoppedRef.current = true;
          void requestStart().catch((err) => {
            console.error("Failed to restart project after stop:", err);
            restartAfterStoppedRef.current = false;
          });
        }

        if (
          data.status === "ready" ||
          data.status === "error" ||
          data.status === "timeout"
        ) {
          restartAfterStoppedRef.current = false;
        }
      }
    };

    socket.on("container:status", onContainerStatus);

    return () => {
      socket.off("container:status", onContainerStatus);
    };
  }, [socket, projectId, setupStore.isInstalling, markInstallDone]);

  const closeProject = async () => {
    try {
      await stopProject(projectId);
    } catch (err) {
      console.error("Failed to stop project during close:", err);
    } finally {
      navigate({ to: "/" });
    }
  };

  const handleStart = async () => {
    try {
      await requestStart();
    } catch (err) {
      console.error("Failed to start project:", err);
      if (axios.isAxiosError(err)) {
        const message =
          (err.response?.data as { error?: string; message?: string })?.error ||
          (err.response?.data as { error?: string; message?: string })
            ?.message ||
          err.message;
        setContainerStatus("error");
        setContainerMsg(message || "Failed to start container");
      }
    }
  };

  const handleRetry = async () => {
    // Re-init setup store and re-trigger start
    initForProject(projectId);
    await handleStart();
  };

  const handleOpenEditorEarly = () => {
    openEditorEarly();
    // Update project context so the editor mounts properly
    setProjectContext(projectId, containerStatus);
  };

  const handleSaveSettings = async (payload: {
    name: string;
    description: string | null;
    installCommand: string | null;
    runCommand: string | null;
    previewCommand: string | null;
    previewPort: number | null;
    envVars: Record<string, string> | null;
    autoSaveEnabled: boolean;
  }) => {
    const [updatedProject, updatedConfig] = await Promise.all([
      updateProject(projectId, {
        name: payload.name,
        description: payload.description,
        autoSaveEnabled: payload.autoSaveEnabled,
      }),
      updateProjectConfig(projectId, {
        installCommand: payload.installCommand,
        runCommand: payload.runCommand,
        previewCommand: payload.previewCommand,
        previewPort: payload.previewPort,
        envVars: payload.envVars,
      }),
    ]);

    const mergedProject: Project = {
      ...updatedProject,
      installCommand: updatedConfig.installCommand ?? null,
      runCommand: updatedConfig.runCommand ?? null,
      previewCommand: updatedConfig.previewCommand ?? null,
      previewPort: updatedConfig.previewPort ?? null,
      envVars: updatedConfig.envVars ?? null,
    };

    setProject(mergedProject);
    setEnvVars(mergedProject.envVars ?? null);
    setRuntimeConfig({
      installCommand: mergedProject.installCommand ?? null,
      runCommand: mergedProject.runCommand ?? null,
      previewCommand: mergedProject.previewCommand ?? null,
      previewPort: mergedProject.previewPort ?? null,
    });
    updateProjectInStore(projectId, mergedProject);
  };

  /* ——— Loading state ——— */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary flex-col gap-4">
        <Loader2 className="animate-spin w-8 h-8 text-accent-primary" />
        <p className="text-sm font-medium animate-pulse">
          Initializing Project...
        </p>
      </div>
    );
  }

  /* ——— Project not found ——— */
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-text-secondary">
            The requested project does not exist or you do not have access.
          </p>
        </div>
      </div>
    );
  }

  /* ——— Status badge color helper ——— */
  const statusDotClass =
    containerStatus === "ready"
      ? "bg-green-500"
      : containerStatus === "pending" ||
          containerStatus === "stopping" ||
          containerStatus === "starting" ||
          containerStatus === "installing"
        ? "bg-yellow-500 animate-pulse"
        : containerStatus === "error"
          ? "bg-red-500"
          : "bg-gray-500";

  /* ——— Main editor view ——— */
  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden">
      {/* Top Navbar */}
      <header className="h-[42px] flex items-center justify-between pl-2 pr-3 bg-bg-secondary border-b border-border-subtle shrink-0 gap-2">
        <div className="flex items-center gap-1">
          <button
            className="flex items-center justify-center w-8 h-8 rounded-md border-none bg-transparent text-text-secondary cursor-pointer transition-all duration-150 hover:bg-bg-tertiary hover:text-text-primary"
            onClick={closeProject}
            title="Back to Dashboard"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="w-px h-[18px] bg-border-subtle ml-0.75 mr-3" />
          <h1 className="font-semibold text-sm truncate max-w-50">
            {project.name}
          </h1>
          <div className="flex items-center gap-1.5 text-[11px] font-medium py-0.5 px-2 ml-2 rounded-md bg-bg-tertiary text-text-secondary">
            <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${statusDotClass}`} />
            <span className="capitalize">
              {containerStatus === "installing" ? "Installing" : containerStatus}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Smart Run / Preview button — disabled while installing */}
          {(containerStatus === "ready" || (containerStatus === "installing" && setupStore.openedEditorEarly)) &&
            (!!runCommand || !!previewCommand) && (
              <button
                onClick={isInstallRunning ? undefined : handlePanelButton}
                disabled={isInstallRunning}
                title={
                  isInstallRunning
                    ? "Waiting for packages to install"
                    : isRightPanelOpen
                      ? `Hide ${isPreviewProject ? "Preview" : "Output"}`
                      : isPanelActive
                        ? `Show ${isPreviewProject ? "Preview" : "Output"}`
                        : `${isPreviewProject ? "Start Preview" : "Run"}`
                }
                className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs font-semibold transition-all duration-150 ${
                  isInstallRunning
                    ? "opacity-40 cursor-not-allowed bg-bg-tertiary text-text-tertiary"
                    : isRightPanelOpen
                      ? "bg-accent-primary text-white shadow-[0_0_10px_rgba(22,163,74,0.3)]"
                      : isPanelActive
                        ? "bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25"
                        : "bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20"
                }`}
              >
                {isPanelActive && !isRightPanelOpen && !isInstallRunning && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse shrink-0" />
                )}
                {isPreviewProject ? (
                  <Monitor size={12} />
                ) : (
                  <Play size={11} />
                )}
                <span>{isPreviewProject ? "Preview" : "Run"}</span>
              </button>
            )}

          <span className="text-xs ml-2 text-text-tertiary hidden sm:inline">
            {isConnected ? "● Connected" : "○ Disconnected"}
          </span>

          {/* Container Start button (when not ready or setting up) */}
          {(containerStatus === "stopped" ||
            containerStatus === "timeout" ||
            containerStatus === "error" ||
            containerStatus === "unknown") && (
            <button
              onClick={handleStart}
              className="flex items-center gap-1.5 py-1 px-3 text-xs font-medium border-none rounded-md cursor-pointer transition-all duration-150 text-white bg-accent-primary hover:bg-accent-secondary"
            >
              <Play size={13} /> Start
            </button>
          )}
        </div>
      </header>

      {/* Workspace Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">

        {/* ── Editor (ready OR early-open during install) ── */}
        {showEditor ? (
          <>
            {/* Install status banner (floating pill at top of editor) */}
            <InstallStatusBanner
              onViewLogs={() => setShowSetupLogs((v) => !v)}
            />

            <EditorLayout
              projectId={projectId}
              userId={user?.id ?? ""}
              containerStatus={containerStatus}
              autoSaveEnabled={project.autoSaveEnabled ?? true}
              runCommand={runCommand}
              previewCommand={previewCommand}
              previewPort={previewPort}
              templateId={templateId}
              execution={execution}
              preview={preview}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
            <FilePalette />
            <ProjectSettingsModal
              open={isSettingsOpen}
              project={{
                ...project,
                installCommand: runtimeConfig.installCommand,
                runCommand,
                previewCommand,
                previewPort,
                envVars,
              }}
              onClose={() => setIsSettingsOpen(false)}
              onSave={handleSaveSettings}
            />

            {/* ── Setup log drawer (shown when user clicks View in banner) ── */}
            {showSetupLogs && (
              <div className="setup-log-drawer">
                <div className="setup-log-drawer-header">
                  <span className="setup-log-drawer-title">
                    Setup Logs
                    {setupStore.isInstalling && (
                      <span className="setup-log-drawer-badge">Installing…</span>
                    )}
                    {setupStore.stage === "done" && (
                      <span className="setup-log-drawer-badge setup-log-drawer-badge-done">Done</span>
                    )}
                  </span>
                  <button
                    className="setup-log-drawer-close"
                    onClick={() => setShowSetupLogs(false)}
                    title="Close logs"
                  >
                    ✕
                  </button>
                </div>
                <div className="setup-log-drawer-body">
                  <SetupLogPanel
                    projectName={project.name}
                    logs={setupStore.logs}
                    stage={setupStore.stage}
                    stageName={setupStore.stageName}
                    progress={setupStore.progress}
                    totalCommands={setupStore.totalCommands}
                    currentCommandIndex={setupStore.currentCommandIndex}
                    canOpenEditor={false}
                    error={setupStore.error}
                    onOpenEditorEarly={() => {}}
                  />
                </div>
              </div>
            )}
          </>
        ) : containerStatus === "error" || containerStatus === "timeout" ? (
          /* ── Error state ── */
          <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary z-50 px-6">
            <div className="w-14 h-14 mb-5 flex items-center justify-center rounded-2xl bg-status-error/15 text-status-error">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-medium text-text-primary mb-2 text-center">
              Workspace failed to start
            </h2>
            <p className="text-sm text-text-secondary max-w-xl text-center mb-6">
              {containerMsg ||
                "Container startup failed. Please return to dashboard and try again."}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 py-2 px-4 text-sm font-medium border-none rounded-md cursor-pointer transition-all duration-150 text-white bg-accent-primary hover:bg-accent-secondary"
              >
                <RefreshCw size={14} /> Retry
              </button>
              <button
                onClick={closeProject}
                className="flex items-center gap-2 py-2 px-4 text-sm font-medium rounded-md cursor-pointer transition-all duration-150 text-text-secondary border border-border-subtle hover:bg-bg-tertiary"
              >
                <ChevronLeft size={14} /> Back to Dashboard
              </button>
            </div>
          </div>
        ) : isSettingUp ? (
          /* ── Setup in progress — logs ── */
          <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary px-6 py-10 gap-8">
            <div className="w-full flex flex-col items-center gap-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-text-tertiary">
                Synthex
              </p>
              <h2 className="text-2xl font-semibold text-text-primary">
                {project.name}
              </h2>
            </div>

            <SetupLogPanel
              projectName={project.name}
              logs={setupStore.logs}
              stage={setupStore.stage}
              stageName={setupStore.stageName}
              progress={setupStore.progress}
              totalCommands={setupStore.totalCommands}
              currentCommandIndex={setupStore.currentCommandIndex}
              canOpenEditor={setupStore.canOpenEditor}
              error={setupStore.error}
              onOpenEditorEarly={handleOpenEditorEarly}
              onRetry={handleRetry}
            />
          </div>
        ) : (
          /* ── Generic loading (pending / starting but no logs yet) ── */
          <div className="flex-1 flex flex-col items-center justify-center bg-bg-primary z-50">
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="w-16 h-16 mb-6 flex items-center justify-center rounded-2xl bg-accent-primary/20 text-accent-primary"
            >
              <Loader2 className="w-8 h-8 animate-spin" />
            </motion.div>
            <h2 className="text-xl font-medium text-text-primary mb-2">
              Preparing your workspace
            </h2>
            <p className="text-sm text-text-secondary max-w-md text-center">
              {containerMsg ||
                "Booting up the container and starting services..."}
            </p>
            <div className="mt-8 w-64 h-1 bg-bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent-primary"
                initial={{ width: "0%", x: "0%" }}
                animate={{
                  width: ["0%", "50%", "100%", "100%"],
                  x: ["0%", "0%", "0%", "100%"],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
