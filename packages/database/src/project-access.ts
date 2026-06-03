import type { PrismaClient } from "./generated";

export async function findOwnedProject(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, folderName: true, userId: true },
  });
}

export async function isProjectOwnedBy(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const project = await findOwnedProject(prisma, projectId, userId);
  return project !== null;
}
