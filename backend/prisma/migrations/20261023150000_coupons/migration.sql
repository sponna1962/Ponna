-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountOff" DECIMAL(10,2) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- AlterTable
ALTER TABLE "PayuPayment" ADD COLUMN "couponId" TEXT,
ADD COLUMN "discountAmount" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "PayuPayment_couponId_idx" ON "PayuPayment"("couponId");

-- AddForeignKey
ALTER TABLE "PayuPayment" ADD CONSTRAINT "PayuPayment_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
