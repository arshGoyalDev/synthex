import { pubsub } from "./database";
import { FilesService } from "../modules/files/files.service";

const filesService = new FilesService();

export async function registerSubscribers() {
  await pubsub.subscribe("files:snapshot", async (data) => {
    console.log(
      `[storage-service] Received snapshot: ${data.fileCount} files for ${data.projectId}`,
    );

    try {
      await filesService.handleSnapshot(data);
    } catch (err: any) {
      console.error(`[storage-service] Snapshot handler failed:`, err.message);
    }
  });

  await pubsub.subscribe("fs:change", async (data) => {
    if (data.event !== "delete") return;

    try {
      if (data.userId) {
        await filesService.deleteStoredFile(
          data.projectId,
          data.userId,
          data.filePath,
        );
      } else {
        await filesService.deleteFile(data.projectId, data.filePath);
      }
      console.log(`[storage-service] Deleted file record: ${data.filePath}`);
    } catch (err: any) {
      console.error(`[storage-service] fs:change handler failed:`, err.message);
    }
  });

  await pubsub.subscribe("storage:project:delete", async (data) => {
    try {
      await filesService.deleteProjectData(data.projectId, data.userId);
    } catch (err: any) {
      console.error(
        `[storage-service] Project cleanup failed for ${data.projectId}:`,
        err.message,
      );
    }
  });
}
