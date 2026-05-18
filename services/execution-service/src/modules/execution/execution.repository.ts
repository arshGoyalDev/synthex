import { db } from "../../config/database";

class ExecutionRepository {
  async create(data: {
    executionId: string;
    projectId: string;
    userId: string;
    command: string;
    isDevServer: boolean;
  }) {
    return db.executionLog.create({
      data: {
        ...data,
        status: "queued",
      },
    });
  }

  async findByExecutionId(executionId: string) {
    return db.executionLog.findUnique({ where: { executionId } });
  }

  async findByProject(projectId: string, limit = 20) {
    return db.executionLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async updateStatus(
    executionId: string,
    data: {
      status: string;
      output?: string;
      error?: string;
      exitCode?: number;
      durationMs?: number;
      completedAt?: Date;
    },
  ) {
    return db.executionLog.update({
      where: { executionId },
      data,
    });
  }

  async findStaleRunning(olderThanMs: number) {
    return db.executionLog.findMany({
      where: {
        status: "running",
        createdAt: { lt: new Date(Date.now() - olderThanMs) },
        isDevServer: false,
      },
    });
  }

  async findExecutionIdsByProject(projectId: string) {
    return db.executionLog.findMany({
      where: { projectId },
      select: { executionId: true },
    });
  }

  async deleteByProject(projectId: string) {
    return db.executionLog.deleteMany({ where: { projectId } });
  }
}

export { ExecutionRepository };
