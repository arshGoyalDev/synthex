-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "env_vars" JSONB,
ADD COLUMN     "import_source" TEXT,
ADD COLUMN     "install_command" TEXT,
ADD COLUMN     "preview_command" TEXT,
ADD COLUMN     "preview_port" INTEGER,
ADD COLUMN     "repo_branch" TEXT,
ADD COLUMN     "repo_url" TEXT,
ADD COLUMN     "run_command" TEXT,
ADD COLUMN     "zip_key" TEXT;
