ALTER TABLE "project_files" RENAME COLUMN "minio_path" TO "object_path";

ALTER TABLE "project_snapshots" RENAME COLUMN "minio_key" TO "object_key";
