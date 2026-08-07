-- Production authentication, device identity, and audit support.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;

ALTER TABLE "Device" ADD COLUMN "authTokenHash" TEXT;
ALTER TABLE "Device" ADD COLUMN "lastIpAddress" TEXT;
ALTER TABLE "Device" ADD COLUMN "lastError" TEXT;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- Retire the development bootstrap identity. A company-controlled administrator
-- is created explicitly during deployment, with its generated password stored
-- only in the local handoff vault.
UPDATE "User"
SET "isActive" = false,
    "sessionVersion" = "sessionVersion" + 1,
    "mustChangePassword" = true,
    "passwordHash" = NULL
WHERE "email" = 'conner@two-a-days.com';
