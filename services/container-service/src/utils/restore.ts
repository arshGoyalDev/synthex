import Dockerode from "dockerode";
import { minioClient, SNAPSHOT_BUCKET } from "../config/database";

export async function restoreSnapshot(
  container: Dockerode.Container,
  snapshotKey: string,
  projectName: string,
): Promise<void> {
  console.log(`[snapshot] Restoring from ${snapshotKey}`);

  const snapshotStream = await minioClient.getObject(
    SNAPSHOT_BUCKET,
    snapshotKey,
  );

  const zlib = require("zlib");
  const gunzip = zlib.createGunzip();
  const tarStream = snapshotStream.pipe(gunzip);

  // Snapshot entries are relative to the project root (e.g. "src/App.css"),
  // so extract into /workspace/${projectName}
  await container.putArchive(tarStream, {
    path: `/workspace/${projectName}`,
  });

  console.log(`[snapshot] Restored ${snapshotKey} into container`);
}
