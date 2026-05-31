-- CreateTable
CREATE TABLE "project_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "minio_key" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "file_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_snapshots_project_id_idx" ON "project_snapshots"("project_id");

-- CreateIndex
CREATE INDEX "project_snapshots_created_at_idx" ON "project_snapshots"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
