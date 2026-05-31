/*
  Warnings:

  - Added the required column `folder_name` to the `projects` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('pending', 'starting', 'ready', 'stopped', 'error', 'timeout');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "container_status" "ContainerStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "folder_name" TEXT NOT NULL;
