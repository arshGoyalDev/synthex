import { create } from "zustand";

export type SetupLogType = "info" | "success" | "error" | "command";
export type SetupStage = "install" | "setup" | "postSetup" | "done" | "error" | "idle";

export interface SetupLogLine {
  projectId: string;
  seq: number;
  type: SetupLogType;
  text: string;
  timestamp: number;
  commandIndex: number;
  totalCommands: number;
}

interface SetupState {
  // The projectId this store is tracking (null = no active setup)
  projectId: string | null;
  stage: SetupStage;
  stageName: string;
  logs: SetupLogLine[];
  progress: number; // 0-100
  /** postSetup (npm install etc) is running but user CAN open editor */
  canOpenEditor: boolean;
  /** specifically postSetup running */
  isInstalling: boolean;
  totalCommands: number;
  currentCommandIndex: number;
  error: string | null;
  /** user dismissed the setup screen to open editor early */
  openedEditorEarly: boolean;
  /** install-done banner visible */
  showInstallDoneBanner: boolean;
  showInstallRunningBanner: boolean;
}

interface SetupActions {
  initForProject: (projectId: string) => void;
  appendLog: (line: SetupLogLine) => void;
  applyStage: (data: {
    projectId: string;
    stage: SetupStage;
    stageName: string;
    commandIndex: number;
    totalCommands: number;
  }) => void;
  applyStatus: (data: { projectId: string; status: string; progress: number }) => void;
  setProgress: (progress: number) => void;
  setError: (error: string) => void;
  openEditorEarly: () => void;
  dismissInstallBanner: () => void;
  markInstallDone: () => void;
  reset: () => void;
}

const DEFAULT_STATE: SetupState = {
  projectId: null,
  stage: "idle",
  stageName: "",
  logs: [],
  progress: 0,
  canOpenEditor: false,
  isInstalling: false,
  totalCommands: 0,
  currentCommandIndex: 0,
  error: null,
  openedEditorEarly: false,
  showInstallDoneBanner: false,
  showInstallRunningBanner: false,
};

export const useSetupStore = create<SetupState & SetupActions>()((set, get) => ({
  ...DEFAULT_STATE,

  initForProject: (projectId) => {
    // Don't reset if we're already tracking the same project mid-setup
    const current = get();
    if (current.projectId === projectId && current.stage !== "idle") return;
    set({ ...DEFAULT_STATE, projectId });
  },

  appendLog: (line) => {
    const current = get();
    if (current.projectId !== line.projectId) return;

    // Deduplicate by seq (can happen on buffer replay + live)
    const exists = current.logs.some((l) => l.seq === line.seq);
    if (exists) return;

    set((s) => ({
      logs: [...s.logs, line].sort((a, b) => a.seq - b.seq),
      currentCommandIndex: Math.max(s.currentCommandIndex, line.commandIndex),
      totalCommands: line.totalCommands > 0 ? line.totalCommands : s.totalCommands,
      progress:
        line.totalCommands > 0
          ? Math.round((line.commandIndex / line.totalCommands) * 100)
          : s.progress,
    }));
  },

  applyStage: (data) => {
    const current = get();
    if (current.projectId !== data.projectId) return;

    const isInstalling = data.stage === "postSetup";
    const isDone = data.stage === "done";
    const isError = data.stage === "error";

    set({
      stage: data.stage,
      stageName: data.stageName,
      currentCommandIndex: data.commandIndex,
      totalCommands: data.totalCommands,
      progress: isDone
        ? 100
        : data.totalCommands > 0
          ? Math.round((data.commandIndex / data.totalCommands) * 100)
          : 0,
      isInstalling,
      // canOpenEditor = install+setup done, only postSetup left
      canOpenEditor: isInstalling || (isDone && current.canOpenEditor),
      showInstallRunningBanner: isInstalling && current.openedEditorEarly,
      error: isError ? data.stageName : null,
    });
  },

  applyStatus: (data) => {
    const current = get();
    if (current.projectId !== data.projectId) return;

    if (data.status === "completed") {
      set({
        stage: "done",
        progress: 100,
        isInstalling: false,
        showInstallRunningBanner: false,
        showInstallDoneBanner: current.openedEditorEarly,
      });
    } else if (data.status === "error") {
      set({ stage: "error", error: "Setup failed" });
    } else if (data.status === "running") {
      set({ stage: "install", progress: data.progress });
    }
  },

  setProgress: (progress) => set({ progress }),

  setError: (error) => set({ stage: "error", error }),

  openEditorEarly: () => {
    set({
      openedEditorEarly: true,
      showInstallRunningBanner: true,
      showInstallDoneBanner: false,
    });
  },

  dismissInstallBanner: () => {
    set({ showInstallRunningBanner: false, showInstallDoneBanner: false });
  },

  markInstallDone: () => {
    const current = get();
    set({
      stage: "done",
      progress: 100,
      isInstalling: false,
      showInstallRunningBanner: false,
      showInstallDoneBanner: current.openedEditorEarly,
    });
  },

  reset: () => set(DEFAULT_STATE),
}));
