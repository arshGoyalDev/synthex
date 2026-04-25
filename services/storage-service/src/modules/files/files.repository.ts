import { db, prisma } from "../../config/database";

class FilesRepository {
  async findByProject(projectId: string) {
    return db.projectFile.findMany({
      where: { projectId },
      orderBy: { filePath: "asc" },
    });
  }

  async findByPath(projectId: string, filePath: string) {
    return db.projectFile.findUnique({
      where: { projectId_filePath: { projectId, filePath } },
    });
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
            mimeType: file.mimeType,
            content: file.content,
          },
          update: {
            fileName: file.fileName,
            minioPath: file.minioPath,
            sizeBytes: BigInt(file.sizeBytes),
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

  async deleteAllForProject(projectId: string) {
    return db.projectFile.deleteMany({ where: { projectId } });
  }
}

export { FilesRepository };
