/*
  Warnings:

  - You are about to drop the column `language` on the `projects` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "projects_language_idx";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "language",
ADD COLUMN     "languages" TEXT[];

-- CreateIndex
CREATE INDEX "projects_languages_idx" ON "projects"("languages");
