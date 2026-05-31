/*
  Warnings:

  - The `language` column on the `projects` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('template', 'blank', 'raw');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "type" "ProjectType" NOT NULL DEFAULT 'template',
DROP COLUMN "language",
ADD COLUMN     "language" TEXT[];

-- CreateIndex
CREATE INDEX "projects_language_idx" ON "projects"("language");
