import { db, prisma } from "../../config/database";

class FilesRepository {
  async findByProject(projectId: string) {
    const files = await db.projectFile.findMany({
      where: { projectId },
      orderBy: { filePath: "asc" },
    });
    return files.map((file) => ({
      ...file,
      sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : null,
    }));
  }

  async findByPath(projectId: string, filePath: string) {
    const file = await db.projectFile.findUnique({
      where: { projectId_filePath: { projectId, filePath } },
    });
    if (!file) return null;
    return {
      ...file,
      sizeBytes: file.sizeBytes ? Number(file.sizeBytes) : null,
    };
  }

  async upsertMany(
    files: Array<{
      projectId: string;
      filePath: string;
      fileName: string;
      minioPath: string;
      sizeBytes: number;
      mimeType: string | null;
      content: string | null;
      contentHash?: string | null;
    }>,
  ) {
    return prisma.$transaction(
      files.map((file) =>
        db.projectFile.upsert({
          where: {
            projectId_filePath: {
              projectId: file.projectId,
              filePath: file.filePath,
            },
          },
          create: {
            projectId: file.projectId,
            filePath: file.filePath,
            fileName: file.fileName,
            minioPath: file.minioPath,
            sizeBytes: BigInt(file.sizeBytes),
            contentHash: file.contentHash ?? null,
            mimeType: file.mimeType,
            content: file.content,
          },
          update: {
            fileName: file.fileName,
            minioPath: file.minioPath,
            sizeBytes: BigInt(file.sizeBytes),
            contentHash: file.contentHash ?? null,
            mimeType: file.mimeType,
            content: file.content,
            updatedAt: new Date(),
          },
        }),
      ),
    );
  }

  async delete(projectId: string, filePath: string) {
    return db.projectFile.deleteMany({
      where: { projectId, filePath },
    });
  }

  async deleteMissing(projectId: string, keepFilePaths: string[]) {
    if (keepFilePaths.length === 0) {
      return db.projectFile.deleteMany({ where: { projectId } });
    }

    return db.projectFile.deleteMany({
      where: {
        projectId,
        filePath: { notIn: keepFilePaths },
      },
    });
  }

  async deleteAllForProject(projectId: string) {
    return db.projectFile.deleteMany({ where: { projectId } });
  }
}

export { FilesRepository };
