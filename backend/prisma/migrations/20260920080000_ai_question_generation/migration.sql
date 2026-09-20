-- CreateEnum
CREATE TYPE "AiQuestionGenerationStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiQuestionGenerationExam" AS ENUM ('TNPSC', 'UPSC', 'OTHER');

-- CreateTable
CREATE TABLE "AiQuestionGenerationRun" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "exam" "AiQuestionGenerationExam" NOT NULL,
    "requestedDifficulty" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "sourceName" TEXT,
    "sourceText" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "status" "AiQuestionGenerationStatus" NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiQuestionGenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiQuestionGenerationRun_status_createdAt_idx" ON "AiQuestionGenerationRun"("status", "createdAt");
