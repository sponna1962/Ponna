-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_ADMIN', 'VIEWER_STAFF');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PLAN_20', 'PLAN_50');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISABLED');

-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('STANDARD', 'CURRENT_AFFAIRS');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('TA', 'EN');

-- CreateEnum
CREATE TYPE "CorrectOption" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "QuizMode" AS ENUM ('MIXED', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PerformanceBucket" AS ENUM ('OVERALL', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "preferredLang" "Language" NOT NULL DEFAULT 'TA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "dailyLimit" INTEGER,
    "cycleLimit" INTEGER,
    "cycleDays" INTEGER NOT NULL DEFAULT 30,
    "price" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "questionsUsedInCycle" INTEGER NOT NULL DEFAULT 0,
    "dailyUsedDate" TIMESTAMP(3),
    "questionsUsedToday" INTEGER NOT NULL DEFAULT 0,
    "razorpayPaymentId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExamType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubType" (
    "id" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ExamSubType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctOption" "CorrectOption" NOT NULL,
    "language" "Language" NOT NULL,
    "translationGroupId" TEXT,
    "examTypeId" TEXT,
    "examSubTypeId" TEXT,
    "difficulty" "Difficulty",
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "category" "QuestionCategory" NOT NULL DEFAULT 'STANDARD',
    "relevanceDate" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "sourceBatchId" TEXT,
    "aiSuggestedDifficulty" "Difficulty",
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "QuizMode" NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "selectedOption" "CorrectOption",
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "QuizSessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "modeTakenIn" "QuizMode" NOT NULL,
    "answeredCorrectly" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQuestionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerformanceSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" "PerformanceBucket" NOT NULL,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "averagePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPerformanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "repetitionStrategy" TEXT NOT NULL DEFAULT 'UNSEEN_FIRST_THEN_OLDEST',
    "repeatAfterDays" INTEGER,
    "caMaxFor5Q" INTEGER NOT NULL DEFAULT 1,
    "caMaxFor20Q" INTEGER NOT NULL DEFAULT 2,
    "caMaxFor50Q" INTEGER NOT NULL DEFAULT 5,
    "caRecencyWindowDays" INTEGER NOT NULL DEFAULT 90,
    "aiConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "rankingEligibilityMinQuestions" INTEGER NOT NULL DEFAULT 50,
    "sessionInactivityHours" INTEGER NOT NULL DEFAULT 48,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");
CREATE INDEX "StaffUser_role_idx" ON "StaffUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_razorpayPaymentId_key" ON "Subscription"("razorpayPaymentId");
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
CREATE INDEX "Subscription_cycleEnd_idx" ON "Subscription"("cycleEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ExamType_name_key" ON "ExamType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubType_examTypeId_name_key" ON "ExamSubType"("examTypeId", "name");

-- CreateIndex
CREATE INDEX "Question_status_difficulty_category_idx" ON "Question"("status", "difficulty", "category");
CREATE INDEX "Question_contentHash_idx" ON "Question"("contentHash");
CREATE INDEX "Question_translationGroupId_idx" ON "Question"("translationGroupId");
CREATE INDEX "Question_category_relevanceDate_idx" ON "Question"("category", "relevanceDate");

-- CreateIndex
CREATE INDEX "QuizSession_userId_status_idx" ON "QuizSession"("userId", "status");
CREATE INDEX "QuizSession_status_lastActivityAt_idx" ON "QuizSession"("status", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuizSessionQuestion_sessionId_questionId_key" ON "QuizSessionQuestion"("sessionId", "questionId");
CREATE INDEX "QuizSessionQuestion_sessionId_sequenceNumber_idx" ON "QuizSessionQuestion"("sessionId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuestionHistory_userId_questionId_key" ON "UserQuestionHistory"("userId", "questionId");
CREATE INDEX "UserQuestionHistory_userId_difficulty_idx" ON "UserQuestionHistory"("userId", "difficulty");
CREATE INDEX "UserQuestionHistory_userId_answeredAt_idx" ON "UserQuestionHistory"("userId", "answeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPerformanceSummary_userId_bucket_key" ON "UserPerformanceSummary"("userId", "bucket");
CREATE INDEX "UserPerformanceSummary_bucket_averagePercent_idx" ON "UserPerformanceSummary"("bucket", "averagePercent");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubType" ADD CONSTRAINT "ExamSubType_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_examSubTypeId_fkey" FOREIGN KEY ("examSubTypeId") REFERENCES "ExamSubType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSessionQuestion" ADD CONSTRAINT "QuizSessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QuizSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuizSessionQuestion" ADD CONSTRAINT "QuizSessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestionHistory" ADD CONSTRAINT "UserQuestionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserQuestionHistory" ADD CONSTRAINT "UserQuestionHistory_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerformanceSummary" ADD CONSTRAINT "UserPerformanceSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
