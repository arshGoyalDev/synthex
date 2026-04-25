import { db } from "../../config/database";

class SnapshotRepository {
  async create(data: {
    projectId: string;
    userId: string;
    minioKey: string;
    sizeBytes: number;
    fileCount: number;
  }) {
    return db.projectSnapshot.create({
      data: {
        ...data,
        sizeBytes: BigInt(data.sizeBytes),
      },
    });
  }

  async getLatest(projectId: string) {
    return db.projectSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listAll(projectId: string) {
    return db.projectSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteOld(projectId: string, keepCount = 5) {
    const all = await this.listAll(projectId);
    const toDelete = all.slice(keepCount);

    for (const snapshot of toDelete) {
      await db.projectSnapshot.delete({ where: { id: snapshot.id } });
    }

    return toDelete;
  }
}

export { SnapshotRepository };