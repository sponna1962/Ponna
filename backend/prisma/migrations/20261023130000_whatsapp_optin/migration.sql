-- AlterTable
ALTER TABLE "User" ADD COLUMN "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "whatsappOptInAt" TIMESTAMP(3),
ADD COLUMN "whatsappWelcomeSentAt" TIMESTAMP(3);
