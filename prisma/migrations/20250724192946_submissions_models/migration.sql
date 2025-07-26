-- CreateTable
CREATE TABLE "SubmissionGroup" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionPage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "image" BYTEA NOT NULL,

    CONSTRAINT "SubmissionPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionGroup_assignmentId_studentName_key" ON "SubmissionGroup"("assignmentId", "studentName");

-- AddForeignKey
ALTER TABLE "SubmissionGroup" ADD CONSTRAINT "SubmissionGroup_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionPage" ADD CONSTRAINT "SubmissionPage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SubmissionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
