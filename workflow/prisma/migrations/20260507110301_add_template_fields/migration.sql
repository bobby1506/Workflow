-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "isReadonly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateSourceId" TEXT;

-- CreateIndex
CREATE INDEX "Workflow_isTemplate_idx" ON "Workflow"("isTemplate");
