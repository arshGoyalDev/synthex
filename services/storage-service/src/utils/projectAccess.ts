import { getProjectDbClient, findOwnedProject } from "@synthex/database";
import { AppError } from "./AppError";

const projectPrisma = getProjectDbClient();

export async function assertProjectOwner(projectId: string, userId: string) {
  const project = await findOwnedProject(projectPrisma, projectId, userId);
  if (!project) {
    throw new AppError("Project not found", 404);
  }
  return project;
}
