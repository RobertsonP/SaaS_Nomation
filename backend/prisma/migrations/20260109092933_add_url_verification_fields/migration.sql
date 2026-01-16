-- AlterTable
ALTER TABLE "project_urls" ADD COLUMN     "lastVerified" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
