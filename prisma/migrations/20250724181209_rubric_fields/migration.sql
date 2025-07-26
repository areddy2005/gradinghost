-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "rubric" JSONB,
ADD COLUMN     "rubricPoints" INTEGER DEFAULT 0,
ADD COLUMN     "rubricValid" BOOLEAN NOT NULL DEFAULT false;
