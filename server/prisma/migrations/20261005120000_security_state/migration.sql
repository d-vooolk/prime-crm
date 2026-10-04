-- CreateTable
CREATE TABLE "SecurityState" (
    "id" TEXT NOT NULL,
    "sessionsRevokedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityState_pkey" PRIMARY KEY ("id")
);
