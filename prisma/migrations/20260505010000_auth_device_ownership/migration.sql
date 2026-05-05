-- Add device ownership for web authentication.
ALTER TABLE "Device" ADD COLUMN "ownerUserId" TEXT;

-- Create the super user. The password hash is scrypt(salt, password).
INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "createdAt", "updatedAt")
VALUES (
  'courtcast-super-user',
  'conner@two-a-days.com',
  'scrypt$c08bb51ccf775ce870a35aa319ee64ab$2280386d0fec5f8a509f56ede73cb3886124483e35873a091c45aedab4774a1bf0f201b17165bf46fd59eb9194e58b41b55641a71b90688495af2e5bcdd5870b',
  'CourtCast Super Admin',
  'super',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT("email") DO UPDATE SET
  "passwordHash" = excluded."passwordHash",
  "name" = excluded."name",
  "role" = excluded."role",
  "updatedAt" = CURRENT_TIMESTAMP;

CREATE INDEX "Device_ownerUserId_idx" ON "Device"("ownerUserId");
