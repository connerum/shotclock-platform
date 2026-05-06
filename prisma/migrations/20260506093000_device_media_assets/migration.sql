-- Device-scoped media assets for presentation control buttons.
CREATE TABLE "DeviceMediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceMediaAsset_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("deviceId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DeviceMediaAsset_deviceId_slot_idx" ON "DeviceMediaAsset"("deviceId", "slot");
