-- Repair media rows created while uploads used Date.now() for sortOrder.
-- Prisma Int maps to a 32-bit signed integer, so these oversized values
-- cannot be read back through Prisma even though SQLite stored them.
UPDATE "DeviceMediaAsset"
SET "sortOrder" = 0
WHERE "sortOrder" > 2147483647
   OR "sortOrder" < -2147483648;
