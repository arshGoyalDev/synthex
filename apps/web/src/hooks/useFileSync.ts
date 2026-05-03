import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Socket } from "socket.io-client";
import { useEditorStore } from "../stores/editor.store";
import {
  listFiles,
  getFile,
  saveFile,
  deleteFile,
  renameFile,
} from "../services/storage.service";
import { ensureLeadingSlash, getFileLanguage } from "../utils/filePath";

type FsChangePayload = {
  projectId: string;
  event: "add" | "change" | "delete" | "rename";
  filePath: string;
  newPath?: string;
  isFolder?: boolean;
};

const AUTOSAVE_DELAY_MS = 900;

export function useFileSync({
  projectId,
  socket,
  enabled,
  mode = "full",
}: {
  projectId: string;
  socket: Socket | null;
  enabled: boolean;
  mode?: "full" | "actions";
}) {
  const files = useEditorStore((s) => s.files);
  const groups = useEditorStore((s) => s.groups);
  const setFilesLoading = useEditorStore((s) => s.setFilesLoading);
  const setFilesError = useEditorStore((s) => s.setFilesError);
  const setFilesFromServer = useEditorStore((s) => s.setFilesFromServer);
  const setFileContentFromServer = useEditorStore(
    (s) => s.setFileContentFromServer,
  );
  const markFileSaving = useEditorStore((s) => s.markFileSaving);
  const markFileSaved = useEditorStore((s) => s.markFileSaved);
  const markFileSaveError = useEditorStore((s) => s.markFileSaveError);
  const createNode = useEditorStore((s) => s.createNode);
  const renameNode = useEditorStore((s) => s.renameNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);

  const autosaveTimers = useRef(new Map<string, number>());
  const pendingFetches = useRef(new Set<string>());

  const openedPaths = useMemo(() => {
    const paths = new Set<string>();
    Object.values(groups).forEach((group) => {
      group.openTabs.forEach((path) => paths.add(path));
    });
    return paths;
  }, [groups]);

  const refreshFileList = useCallback(async () => {
    if (!projectId) return;
    setFilesLoading(true);
    setFilesError(null);
    try {
      const records = await listFiles(projectId);
      const normalized = records.map((record) => {
        const path = ensureLeadingSlash(record.filePath);
        return {
          path,
          name: record.fileName ?? path.split("/").pop() ?? path,
          isFolder: false,
          language: getFileLanguage(path),
        };
      });
      setFilesFromServer(normalized);
    } catch (err: any) {
      setFilesError(err?.message ?? "Failed to load files");
    } finally {
      setFilesLoading(false);
    }
  }, [projectId, setFilesLoading, setFilesError, setFilesFromServer]);

  const hydrateOpenFiles = useCallback(async () => {
    if (!projectId) return;
    const toFetch = Array.from(openedPaths).filter(
      (path) => !pendingFetches.current.has(path),
    );
    if (toFetch.length === 0) return;

    toFetch.forEach((path) => pendingFetches.current.add(path));

    await Promise.all(
      toFetch.map(async (path) => {
        try {
          const record = await getFile(projectId, path);
          const content = record.content ?? "";
          setFileContentFromServer(path, content);
        } catch (err: any) {
          markFileSaveError(path, err?.message ?? "Failed to load file");
        } finally {
          pendingFetches.current.delete(path);
        }
      }),
    );
  }, [openedPaths, projectId, setFileContentFromServer, markFileSaveError]);

  const flushSave = useCallback(
    async (path: string) => {
      if (!projectId) return;
      const file = files.get(path);
      if (!file || file.isFolder) return;
      const content = file.content ?? "";
      if (file.isSaving && file.lastSaveAttemptContent === content) return;
      if (file.lastSavedContent === content) {
        markFileSaved(path);
        return;
      }
      markFileSaving(path, true);
      try {
        await saveFile(projectId, path, content);
        markFileSaved(path);
      } catch (err: any) {
        markFileSaveError(path, err?.message ?? "Failed to save");
      } finally {
        markFileSaving(path, false);
      }
    },
    [files, markFileSaveError, markFileSaved, markFileSaving, projectId],
  );

  const queueAutosave = useCallback(
    (path: string) => {
      const file = files.get(path);
      if (!file || file.isFolder) return;
      if (!file.isDirty) return;

      const existing = autosaveTimers.current.get(path);
      if (existing) window.clearTimeout(existing);

      const timeoutId = window.setTimeout(() => {
        autosaveTimers.current.delete(path);
        void flushSave(path);
      }, AUTOSAVE_DELAY_MS);

      autosaveTimers.current.set(path, timeoutId);
    },
    [files, flushSave],
  );

  const handleSaveNow = useCallback(
    async (path: string) => {
      const existing = autosaveTimers.current.get(path);
      if (existing) {
        window.clearTimeout(existing);
        autosaveTimers.current.delete(path);
      }
      await flushSave(path);
    },
    [flushSave],
  );

  const handleDelete = useCallback(
    async (path: string) => {
      if (!projectId) return;
      await deleteFile(projectId, path);
    },
    [projectId],
  );

  const handleCreate = useCallback(
    async (path: string, isFolder: boolean) => {
      if (!projectId) return;
      if (isFolder) {
        return;
      }
      await saveFile(projectId, path, "");
    },
    [projectId],
  );

  const handleRename = useCallback(
    async (oldPath: string, newPath: string) => {
      if (!projectId) return;
      await renameFile(projectId, oldPath, newPath);
    },
    [projectId],
  );

  useEffect(() => {
    if (mode !== "full") return;
    if (!enabled || !projectId) return;
    void refreshFileList();
  }, [mode, enabled, projectId, refreshFileList]);

  useEffect(() => {
    if (mode !== "full") return;
    if (!enabled || !projectId) return;
    void hydrateOpenFiles();
  }, [mode, enabled, projectId, hydrateOpenFiles]);

  useEffect(() => {
    if (mode !== "full") return;
    if (!socket || !enabled || !projectId) return;

    const onFsChange = (payload: FsChangePayload) => {
      if (payload.projectId !== projectId) return;

      const path = ensureLeadingSlash(payload.filePath);
      if (payload.event === "delete") {
        deleteNode(path);
        return;
      }

      if (payload.event === "rename" && payload.newPath) {
        const nextPath = ensureLeadingSlash(payload.newPath);
        renameNode(path, nextPath, nextPath.split("/").pop() ?? nextPath);
        return;
      }

      if (payload.event === "add") {
        const name = path.split("/").pop() ?? path;
        createNode(path, name, !!payload.isFolder);
        return;
      }

      if (payload.event === "change") {
        if (openedPaths.has(path)) {
          void getFile(projectId, path)
            .then((record) => {
              setFileContentFromServer(path, record.content ?? "");
            })
            .catch(() => undefined);
        }
      }
    };

    socket.on("container:fs:change", onFsChange);

    return () => {
      socket.off("container:fs:change", onFsChange);
    };
  }, [mode, socket, enabled, projectId, deleteNode, renameNode, createNode, openedPaths, setFileContentFromServer]);

  useEffect(() => {
    if (mode !== "full") return;
    if (!enabled || !projectId) return;
    files.forEach((file) => {
      if (!file.isFolder && file.isDirty && !file.isSaving) {
        queueAutosave(file.path);
      }
    });
  }, [mode, files, enabled, projectId, queueAutosave]);

  useEffect(() => {
    return () => {
      autosaveTimers.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      autosaveTimers.current.clear();
      pendingFetches.current.clear();
    };
  }, []);

  return {
    refreshFileList,
    handleSaveNow,
    handleDelete,
    handleCreate,
    handleRename,
  };
}
