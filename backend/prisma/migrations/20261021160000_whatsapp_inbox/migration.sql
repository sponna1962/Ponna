-- CreateTable
CREATE TABLE "WhatsAppContact" (
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "optedOutAt" TIMESTAMP(3),
    "firstInboundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "lastAutoReplyAt" TIMESTAMP(3),
    "welcomedAt" TIMESTAMP(3),

    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_waMessageId_key" ON "WhatsAppMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_phone_createdAt_idx" ON "WhatsAppMessage"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");
