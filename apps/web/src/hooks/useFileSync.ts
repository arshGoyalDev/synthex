import { useEffect, useRef, useCallback } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useEditorStore } from "../stores/editor.store";
import type { FileEntry } from "../stores/editor.store";
import * as storageService from "../services/storage.service";
import { getMonacoLanguage } from "../utils/monacoLanguage";

// ─── Configuration ──────────────────────────────────────────────────────────

const AUTO_SAVE_DELAY_MS = 1500;

// ─── Helper: map storage file to editor FileEntry ───────────────────────────

function toFileEntry(sf: storageService.StorageFileEntry): FileEntry {
  return {
    path: `/${sf.filePath}`,
    name: sf.fileName,
    language: getMonacoLanguage(sf.fileName),
    content: sf.content ?? undefined,
    isFolder: false,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

interface UseFileSyncOptions {
  projectId: string;
  containerStatus: string;
  autoSaveEnabled: boolean;
}

export function useFileSync({
  projectId,
  containerStatus,
  autoSaveEnabled,
}: UseFileSyncOptions) {
  const { socket } = useSocket();

  // Store actions – grabbed once, stable references
  const setFilesFromServer = useEditorStore((s) => s.setFilesFromServer);
  const mergeFilesFromServer = useEditorStore((s) => s.mergeFilesFromServer);
  const setFileContentFromServer = useEditorStore(
    (s) => s.setFileContentFromServer,
  );
  const setFilesLoading = useEditorStore((s) => s.setFilesLoading);
  const setFilesError = useEditorStore((s) => s.setFilesError);
  const markFileSaving = useEditorStore((s) => s.markFileSaving);
  const markFileSaved = useEditorStore((s) => s.markFileSaved);
  const markFileSaveError = useEditorStore((s) => s.markFileSaveError);

  // Refs for debounce timers (path → timer)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  // Track which files we've already initiated a content fetch for
  const fetchingPaths = useRef<Set<string>>(new Set());

  // ─── 1. Load file list when container becomes ready ───────────────────────

  const isContainerActive = containerStatus === "ready" || containerStatus === "installing";

  useEffect(() => {
    if (!isContainerActive) return;

    let cancelled = false;

    const loadFiles = async () => {
      setFilesLoading(true);
      setFilesError(null);

      try {
        const serverFiles = await storageService.listFiles(projectId);
        if (cancelled) return;

        const entries: FileEntry[] = serverFiles.map(toFileEntry);
        setFilesFromServer(entries);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[useFileSync] Failed to load files:", err);
        setFilesError(err.message || "Failed to load files");
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    };

    loadFiles();

    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    containerStatus,
    setFilesFromServer,
    setFilesLoading,
    setFilesError,
  ]);

  // ─── 2. Lazy-load file content when a file is opened ──────────────────────

  const fetchFileContent = useCallback(
    async (filePath: string) => {
      if (fetchingPaths.current.has(filePath)) return;
      fetchingPaths.current.add(filePath);

      try {
        const file = await storageService.getFileContent(projectId, filePath);
        setFileContentFromServer(filePath, file.content ?? "");
      } catch (err: any) {
        console.error(
          `[useFileSync] Failed to fetch content for ${filePath}:`,
          err,
        );
      } finally {
        fetchingPaths.current.delete(filePath);
      }
    },
    [projectId, setFileContentFromServer],
  );

  // ─── 3. Auto-save dirty files ─────────────────────────────────────────────

  const saveFileNow = useCallback(
    async (filePath: string) => {
      const file = useEditorStore.getState().files.get(filePath);
      if (!file || !file.isDirty || file.isSaving) return;

      const content = file.content ?? "";
      markFileSaving(filePath, true);

      try {
        await storageService.saveFile(projectId, filePath, content);
        markFileSaved(filePath);
      } catch (err: any) {
        console.error(`[useFileSync] Save failed for ${filePath}:`, err);
        markFileSaveError(
          filePath,
          err.response?.data?.error || err.message || "Save failed",
        );
      }
    },
    [projectId, markFileSaving, markFileSaved, markFileSaveError],
  );

  const scheduleSave = useCallback(
    (filePath: string) => {
      // Clear existing timer for this path
      const existing = saveTimers.current.get(filePath);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        saveTimers.current.delete(filePath);
        saveFileNow(filePath);
      }, AUTO_SAVE_DELAY_MS);

      saveTimers.current.set(filePath, timer);
    },
    [saveFileNow],
  );

  // Watch for dirty file changes and schedule saves
  useEffect(() => {
    if (!isContainerActive || !autoSaveEnabled) return;

    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      for (const [path, file] of state.files) {
        const prev = prevState.files.get(path);
        if (file.isDirty && !file.isSaving && file.content !== prev?.content) {
          scheduleSave(path);
        }
      }
    });

    return () => {
      unsubscribe();
      // Clear all pending timers
      for (const timer of saveTimers.current.values()) {
        clearTimeout(timer);
      }
      saveTimers.current.clear();
    };
  }, [autoSaveEnabled, containerStatus, scheduleSave]);

  // ─── 4. WebSocket events ──────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !isContainerActive) return;

    // Full file list refresh
    const onFsRefresh = (data: { projectId: string }) => {
      if (data.projectId !== projectId) return;

      storageService
        .listFiles(projectId)
        .then((serverFiles) => {
          const entries: FileEntry[] = serverFiles.map(toFileEntry);
          mergeFilesFromServer(entries);
        })
        .catch((err) => {
          console.error("[useFileSync] fs:refresh reload failed:", err);
        });
    };

    const onFsChange = (data: {
      projectId: string;
      event: "change" | "delete" | "rename";
      filePath: string;
      newPath?: string;
    }) => {
      if (data.projectId !== projectId) return;

      storageService
        .listFiles(projectId)
        .then((serverFiles) => {
          const entries: FileEntry[] = serverFiles.map(toFileEntry);
          mergeFilesFromServer(entries);
        })
        .catch((err) => {
          console.error("[useFileSync] fs:change reload failed:", err);
        });
    };

    socket.on("container:fs:refresh", onFsRefresh);
    socket.on("container:fs:change", onFsChange);

    return () => {
      socket.off("container:fs:refresh", onFsRefresh);
      socket.off("container:fs:change", onFsChange);
    };
  }, [socket, projectId, containerStatus, mergeFilesFromServer]);

  // ─── 5. Server-backed filesystem operations ───────────────────────────────

  const createFileOnServer = useCallback(
    async (path: string, name: string, isFolder: boolean) => {
      // Optimistic: update local store immediately
      useEditorStore.getState().createNode(path, name, isFolder);

      if (!isFolder) {
        try {
          await storageService.saveFile(projectId, path, "");
        } catch (err: any) {
          console.error(`[useFileSync] Create file failed for ${path}:`, err);
          // Rollback: re-fetch authoritative file list from server
          try {
            const serverFiles = await storageService.listFiles(projectId);
            setFilesFromServer(serverFiles.map(toFileEntry));
          } catch { /* best-effort */ }
        }
      }
    },
    [projectId, setFilesFromServer],
  );

  const renameFileOnServer = useCallback(
    async (oldPath: string, newPath: string, newName: string) => {
      // Optimistic: update local store immediately
      useEditorStore.getState().renameNode(oldPath, newPath, newName);

      try {
        await storageService.renameFile(projectId, oldPath, newPath);
      } catch (err: any) {
        console.error(
          `[useFileSync] Rename failed for ${oldPath} → ${newPath}:`,
          err,
        );
        // Rollback: re-fetch authoritative file list from server
        try {
          const serverFiles = await storageService.listFiles(projectId);
          setFilesFromServer(serverFiles.map(toFileEntry));
        } catch { /* best-effort */ }
      }
    },
    [projectId, setFilesFromServer],
  );

  const deleteFileOnServer = useCallback(
    async (path: string) => {
      // Optimistic: update local store immediately
      useEditorStore.getState().deleteNode(path);

      try {
        await storageService.deleteFile(projectId, path);
      } catch (err: any) {
        console.error(`[useFileSync] Delete failed for ${path}:`, err);
        // Rollback: re-fetch authoritative file list from server
        try {
          const serverFiles = await storageService.listFiles(projectId);
          setFilesFromServer(serverFiles.map(toFileEntry));
        } catch { /* best-effort */ }
      }
    },
    [projectId, setFilesFromServer],
  );

  return {
    fetchFileContent,
    saveFileNow,
    createFileOnServer,
    renameFileOnServer,
    deleteFileOnServer,
  };
}
