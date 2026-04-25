import Dockerode from "dockerode";
import { minioClient, SNAPSHOT_BUCKET } from "../config/database";
import { Readable } from "stream";

export async function restoreSnapshot(
  container: Dockerode.Container,
  snapshotKey: string,
  // projectName: string,
): Promise<void> {
  console.log(`[snapshot] Restoring from ${snapshotKey}`);

  const snapshotStream = await minioClient.getObject(
    SNAPSHOT_BUCKET,
    snapshotKey,
  );

  const zlib = require("zlib");
  const gunzip = zlib.createGunzip();
  const tarStream = snapshotStream.pipe(gunzip);

  await container.putArchive(tarStream, {
    path: "/workspace",
  });

  console.log(`[snapshot] Restored ${snapshotKey} into container`);
}
