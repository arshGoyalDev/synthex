import { useCallback } from "react";
import { useEditorStore } from "../stores/editor.store";
import * as storageService from "../services/storage.service";

/**
 * Returns a stable async function that imperatively saves any file by path.
 * Works independently of useFileSync so any component (e.g. EditorTabs) can
 * trigger an immediate save without going through the debounce timer.
 */
export function useSaveFile() {
  const projectId = useEditorStore((s) => s.projectId);
  const markFileSaving = useEditorStore((s) => s.markFileSaving);
  const markFileSaved = useEditorStore((s) => s.markFileSaved);
  const markFileSaveError = useEditorStore((s) => s.markFileSaveError);

  return useCallback(
    async (filePath: string) => {
      if (!projectId) return;

      const file = useEditorStore.getState().files.get(filePath);
      if (!file || file.isSaving) return;

      const content = file.content ?? "";
      markFileSaving(filePath, true);

      try {
        await storageService.saveFile(projectId, filePath, content);
        markFileSaved(filePath);
      } catch (err: any) {
        console.error(`[useSaveFile] Save failed for ${filePath}:`, err);
        markFileSaveError(
          filePath,
          err.response?.data?.error || err.message || "Save failed",
        );
        throw err; // Re-throw so the caller (dialog) can handle it
      }
    },
    [projectId, markFileSaving, markFileSaved, markFileSaveError],
  );
}
